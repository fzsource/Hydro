import { isSafeInteger } from 'lodash';
import { ObjectID } from 'mongodb';
import {
    DiscussionLockedError, DiscussionNotFoundError, DocumentNotFoundError,
    PermissionError,
} from '../error';
import { DiscussionDoc, DiscussionReplyDoc, DiscussionTailReplyDoc } from '../interface';
import paginate from '../lib/paginate';
import { PERM, PRIV } from '../model/builtin';
import * as discussion from '../model/discussion';
import * as document from '../model/document';
import message from '../model/message';
import * as oplog from '../model/oplog';
import * as system from '../model/system';
import user from '../model/user';
import {
    Handler, param, Route, Types,
} from '../service/server';

export const typeMapper = {
    problem: document.TYPE_PROBLEM,
    contest: document.TYPE_CONTEST,
    node: document.TYPE_DISCUSSION_NODE,
    training: document.TYPE_TRAINING,
    homework: document.TYPE_CONTEST,
};

class DiscussionHandler extends Handler {
    ddoc?: DiscussionDoc;
    drdoc?: DiscussionReplyDoc;
    drrdoc?: DiscussionTailReplyDoc;
    vnode?: any;

    @param('type', Types.Name, true)
    @param('name', Types.Name, true)
    @param('did', Types.ObjectID, true)
    @param('drid', Types.ObjectID, true)
    @param('drrid', Types.ObjectID, true)
    async _prepare(
        domainId: string, type: string, name: string,
        did: ObjectID, drid: ObjectID, drrid: ObjectID,
    ) {
        this.checkPerm(PERM.PERM_VIEW_DISCUSSION);
        if (did) {
            this.ddoc = await discussion.get(domainId, did);
            if (!this.ddoc) throw new DiscussionNotFoundError(domainId, did);
            type = discussion.typeDisplay[this.ddoc.parentType];
            name = this.ddoc.parentId.toString();
            if (drrid) {
                [this.drdoc, this.drrdoc] = await discussion.getTailReply(domainId, drid, drrid);
                if (!this.drrdoc) throw new DiscussionNotFoundError(domainId, drrid);
            } else if (drid) {
                this.drdoc = await discussion.getReply(domainId, drid);
                if (!this.drdoc) throw new DiscussionNotFoundError(domainId, drid);
                if (!this.drdoc.parentId.equals(this.ddoc._id)) {
                    throw new DocumentNotFoundError(domainId, drid);
                }
            }
        }
        // TODO(twd2): do more visibility check eg. contest
        // TODO(twd2): exclude problem/contest discussions?
        // TODO(iceboy): continuation based pagination.
        this.vnode = await discussion.getVnode(domainId, typeMapper[type], name, this.user._id);
        if (this.vnode.assign?.length && !this.user.own(this.vnode)) {
            if (!Set.intersection(this.vnode.assign, this.user.group).size) {
                throw new PermissionError(PERM.PERM_VIEW_PROBLEM_HIDDEN);
            }
        }
        if (this.ddoc) {
            this.ddoc.parentType = this.ddoc.parentType || this.vnode.type;
            this.ddoc.parentId = this.ddoc.parentId || this.vnode.id;
        }
    }
}

class DiscussionMainHandler extends Handler {
    @param('page', Types.PositiveInt, true)
    async get(domainId: string, page = 1) {
        // Limit to known types
        const parentType = { $in: Object.keys(typeMapper).map((i) => typeMapper[i]) };
        const [ddocs, dpcount] = await paginate(
            discussion.getMulti(domainId, { parentType }),
            page,
            system.get('pagination.discussion'),
        );
        const udict = await user.getList(domainId, ddocs.map((ddoc) => ddoc.owner));
        const [vndict, vnodes] = await Promise.all([
            discussion.getListVnodes(domainId, ddocs, this.user.hasPerm(PERM.PERM_VIEW_PROBLEM_HIDDEN), this.user.group),
            discussion.getNodes(domainId),
        ]);
        this.response.template = 'discussion_main_or_node.html';
        this.response.body = {
            ddocs, dpcount, udict, page, page_name: 'discussion_main', vndict, vnode: {}, vnodes,
        };
    }
}

class DiscussionNodeHandler extends DiscussionHandler {
    @param('type', Types.Name)
    @param('name', Types.Name)
    @param('page', Types.PositiveInt, true)
    async get(domainId: string, type: string, _name: string, page = 1) {
        let name: ObjectID | string | number;
        if (ObjectID.isValid(_name)) name = new ObjectID(_name);
        else if (isSafeInteger(parseInt(_name, 10))) name = parseInt(_name, 10);
        else name = _name;
        const [ddocs, dpcount] = await paginate(
            discussion.getMulti(domainId, { parentType: typeMapper[type], parentId: name }),
            page,
            system.get('pagination.discussion'),
        );
        const uids = ddocs.map((ddoc) => ddoc.owner);
        uids.push(this.vnode.owner);
        const [udict, vnodes] = await Promise.all([
            user.getList(domainId, uids),
            discussion.getNodes(domainId),
        ]);
        const vndict = { [typeMapper[type]]: { [name.toString()]: this.vnode } };
        this.response.template = 'discussion_main_or_node.html';
        this.response.body = {
            ddocs,
            dpcount,
            udict,
            page,
            vndict,
            vnode: this.vnode,
            page_name: 'discussion_node',
            vnodes,
        };
    }
}

class DiscussionCreateHandler extends DiscussionHandler {
    async get({ type, name }) {
        const path = [
            ['Hydro', 'homepage'],
            ['discussion_main', 'discussion_main'],
            [this.vnode.title, 'discussion_node', { type, name }, true],
            ['discussion_create', null],
        ];
        this.response.template = 'discussion_create.html';
        this.response.body = { path, vnode: this.vnode };
    }

    @param('type', Types.Name)
    @param('title', Types.Title)
    @param('content', Types.Content)
    @param('highlight', Types.Boolean)
    @param('pin', Types.Boolean)
    async post(
        domainId: string, type: string, title: string,
        content: string, highlight = false, pin = false,
    ) {
        await this.limitRate('add_discussion', 3600, 60);
        if (highlight) this.checkPerm(PERM.PERM_HIGHLIGHT_DISCUSSION);
        if (pin) this.checkPerm(PERM.PERM_PIN_DISCUSSION);
        const did = await discussion.add(
            domainId, typeMapper[type], this.vnode.id, this.user._id,
            title, content, this.request.ip, highlight, pin,
        );
        this.response.body = { did };
        this.response.redirect = this.url('discussion_detail', { did });
    }
}

class DiscussionDetailHandler extends DiscussionHandler {
    @param('did', Types.ObjectID)
    @param('page', Types.PositiveInt, true)
    async get(domainId: string, did: ObjectID, page = 1) {
        const dsdoc = this.user.hasPriv(PRIV.PRIV_USER_PROFILE)
            ? await discussion.getStatus(domainId, did, this.user._id)
            : null;
        const [drdocs, pcount, drcount] = await paginate(
            discussion.getMultiReply(domainId, did),
            page,
            system.get('pagination.reply'),
        );
        const uids = [
            this.ddoc.owner,
            ...drdocs.map((drdoc) => drdoc.owner),
        ];
        for (const drdoc of drdocs) {
            if (drdoc.reply) uids.push(...drdoc.reply.map((drrdoc) => drrdoc.owner));
        }
        const reactions = { [did.toHexString()]: dsdoc?.react || {} };
        await Promise.all(drdocs.map((drdoc) =>
            discussion.getReaction(domainId, document.TYPE_DISCUSSION_REPLY, drdoc._id, this.user._id).then((reaction) => {
                reactions[drdoc._id.toHexString()] = reaction;
            })));
        const udict = await user.getList(domainId, uids);
        if (!dsdoc?.view) {
            await Promise.all([
                discussion.inc(domainId, did, 'views', 1),
                discussion.setStatus(domainId, did, this.user._id, { view: true }),
            ]);
        }
        const path = [
            ['Hydro', 'homepage'],
            ['discussion_main', 'discussion_main'],
            [this.vnode.title, 'discussion_node', { type: discussion.typeDisplay[this.ddoc.parentType], name: this.ddoc.parentId }, true],
            [this.ddoc.title, null, null, true],
        ];
        this.response.template = 'discussion_detail.html';
        this.response.body = {
            path, ddoc: this.ddoc, dsdoc, drdocs, page, pcount, drcount, udict, vnode: this.vnode, reactions,
        };
    }

    async post() {
        this.checkPriv(PRIV.PRIV_USER_PROFILE);
    }

    @param('did', Types.ObjectID)
    @param('lock', Types.Boolean)
    async postSetLock(domainId: string, did: ObjectID, lock: boolean) {
        if (!this.user.own(this.ddoc)) this.checkPerm(PERM.PERM_LOCK_DISCUSSION);
        await discussion.edit(domainId, did, { lock });
        this.back();
    }

    @param('type', Types.Range(['did', 'drid']))
    @param('id', Types.ObjectID)
    @param('emoji', Types.Emoji)
    @param('reverse', Types.Boolean)
    async postReaction(domainId: string, type: string, did: ObjectID, id: string, reverse = false) {
        this.checkPerm(PERM.PERM_ADD_REACTION);
        const docType = type === 'did' ? document.TYPE_DISCUSSION : document.TYPE_DISCUSSION_REPLY;
        const [doc, sdoc] = await discussion.react(domainId, docType, did, id, this.user._id, reverse);
        this.response.body = { doc, sdoc };
        this.back();
    }

    @param('did', Types.ObjectID)
    @param('content', Types.Content)
    async postReply(domainId: string, did: ObjectID, content: string) {
        this.checkPerm(PERM.PERM_REPLY_DISCUSSION);
        if (this.ddoc.lock) throw new DiscussionLockedError(domainId, did);
        await this.limitRate('add_discussion', 3600, 60);
        const targets = new Set(Array.from(content.matchAll(/@\[\]\(\/user\/(\d+)\)/g)).map((i) => +i[1]));
        const uids = Object.keys(await user.getList(domainId, Array.from(targets))).map((i) => +i);
        const msg = JSON.stringify({
            message: 'User {0} mentioned you in {1:link}',
            params: [this.user.uname, `/d/${domainId}${this.request.path}`],
        });
        for (const uid of uids) {
            message.send(1, uid, msg, message.FLAG_RICHTEXT | message.FLAG_UNREAD);
        }
        await discussion.addReply(domainId, did, this.user._id, content, this.request.ip);
        this.back();
    }

    @param('drid', Types.ObjectID)
    @param('content', Types.Content)
    async postTailReply(domainId: string, drid: ObjectID, content: string) {
        this.checkPerm(PERM.PERM_REPLY_DISCUSSION);
        if (this.ddoc.lock) throw new DiscussionLockedError(domainId, this.ddoc.docId);
        await this.limitRate('add_discussion', 3600, 60);
        const targets = new Set(Array.from(content.matchAll(/@\[\]\(\/user\/(\d+)\)/g)).map((i) => +i[1]));
        const uids = Object.keys(await user.getList(domainId, Array.from(targets))).map((i) => +i);
        const msg = JSON.stringify({
            message: 'User {0} mentioned you in {1:link}',
            params: [this.user.uname, `/d/${domainId}${this.request.path}`],
        });
        for (const uid of uids) {
            message.send(1, uid, msg, message.FLAG_RICHTEXT | message.FLAG_UNREAD);
        }
        await discussion.addTailReply(domainId, drid, this.user._id, content, this.request.ip);
        this.back();
    }

    @param('drid', Types.ObjectID)
    @param('content', Types.Content)
    async postEditReply(domainId: string, drid: ObjectID, content: string) {
        this.checkPerm(PERM.PERM_EDIT_DISCUSSION_REPLY_SELF);
        if (!this.user.own(this.drdoc)) throw new PermissionError(PERM.PERM_EDIT_DISCUSSION_REPLY_SELF);
        await Promise.all([
            discussion.editReply(domainId, drid, content),
            oplog.log(this, 'discussion.reply.edit', this.drdoc),
        ]);
        this.back();
    }

    @param('drid', Types.ObjectID)
    async postDeleteReply(domainId: string, drid: ObjectID) {
        if (!(this.user.own(this.ddoc)
            && this.user.hasPerm(PERM.PERM_DELETE_DISCUSSION_REPLY_SELF_DISCUSSION))) {
            if (!this.user.own(this.drdoc)) {
                this.checkPerm(PERM.PERM_DELETE_DISCUSSION_REPLY);
            } else this.checkPerm(PERM.PERM_DELETE_DISCUSSION_SELF);
        }
        await Promise.all([
            discussion.delReply(domainId, drid),
            oplog.log(this, 'discussion.reply.delete', this.drdoc),
        ]);
        this.back();
    }

    @param('drid', Types.ObjectID)
    @param('drrid', Types.ObjectID)
    @param('content', Types.Content)
    async postEditTailReply(domainId: string, drid: ObjectID, drrid: ObjectID, content: string) {
        this.checkPerm(PERM.PERM_EDIT_DISCUSSION_REPLY_SELF);
        if (!this.user.own(this.drrdoc)) throw new PermissionError(PERM.PERM_EDIT_DISCUSSION_REPLY_SELF);
        await Promise.all([
            discussion.editTailReply(domainId, drid, drrid, content),
            oplog.log(this, 'discussion.tailReply.edit', this.drrdoc),
        ]);
        this.back();
    }

    @param('drid', Types.ObjectID)
    @param('drrid', Types.ObjectID)
    async postDeleteTailReply(domainId: string, drid: ObjectID, drrid: ObjectID) {
        if (!this.user.own(this.drrdoc)) this.checkPerm(PERM.PERM_DELETE_DISCUSSION_REPLY);
        await Promise.all([
            discussion.delTailReply(domainId, drid, drrid),
            oplog.log(this, 'discussion.tailReply.delete', this.drrdoc),
        ]);
        this.back();
    }

    @param('did', Types.ObjectID)
    async postStar(domainId: string, did: ObjectID) {
        await discussion.setStar(domainId, did, this.user._id, true);
        this.back({ star: true });
    }

    @param('did', Types.ObjectID)
    async postUnstar(domainId: string, did: ObjectID) {
        await discussion.setStar(domainId, did, this.user._id, false);
        this.back({ star: false });
    }
}

class DiscussionRawHandler extends DiscussionHandler {
    @param('drid', Types.ObjectID, true)
    @param('drrid', Types.ObjectID, true)
    async get(domainId: string, drid: ObjectID, drrid: ObjectID) {
        this.response.type = 'text/markdown';
        this.response.body = drrid ? this.drrdoc.content : drid ? this.drdoc.content : this.ddoc.content;
    }
}

class DiscussionEditHandler extends DiscussionHandler {
    async get() {
        const path = [
            ['Hydro', 'homepage'],
            ['discussion_main', 'discussion_main'],
            [this.vnode.title, 'discussion_node', { type: discussion.typeDisplay[this.ddoc.parentType], name: this.ddoc.parentId }, true],
            [this.ddoc.title, 'discussion_detail', { did: this.ddoc.docId }, true],
            ['discussion_edit', null],
        ];
        this.response.template = 'discussion_edit.html';
        this.response.body = { ddoc: this.ddoc, path };
    }

    @param('did', Types.ObjectID)
    @param('title', Types.Title)
    @param('content', Types.Content)
    @param('highlight', Types.Boolean)
    @param('pin', Types.Boolean)
    async postUpdate(
        domainId: string, did: ObjectID, title: string, content: string,
        highlight = false, pin = false,
    ) {
        if (!this.user.own(this.ddoc)) this.checkPerm(PERM.PERM_EDIT_DISCUSSION);
        else this.checkPerm(PERM.PERM_EDIT_DISCUSSION_SELF);
        if (!this.user.hasPerm(PERM.PERM_HIGHLIGHT_DISCUSSION)) highlight = this.ddoc.highlight;
        if (!this.user.hasPerm(PERM.PERM_PIN_DISCUSSION)) pin = this.ddoc.pin;
        await Promise.all([
            discussion.edit(domainId, did, {
                title, content, highlight, pin,
            }),
            oplog.log(this, 'discussion.edit', this.ddoc),
        ]);
        this.response.body = { did };
        this.response.redirect = this.url('discussion_detail', { did });
    }

    @param('did', Types.ObjectID)
    async postDelete(domainId: string, did: ObjectID) {
        if (!this.user.own(this.ddoc)) this.checkPerm(PERM.PERM_DELETE_DISCUSSION);
        else this.checkPerm(PERM.PERM_DELETE_DISCUSSION_SELF);
        await Promise.all([
            oplog.log(this, 'discussion.delete', this.ddoc),
            discussion.del(domainId, did),
        ]);
        this.response.body = { type: this.ddoc.parentType, parent: this.ddoc.parentId };
        this.response.redirect = this.url('discussion_node', {
            type: discussion.typeDisplay[this.ddoc.parentType],
            name: this.ddoc.parentId,
        });
    }
}

export async function apply() {
    Route('discussion_main', '/discuss', DiscussionMainHandler);
    Route('discussion_detail', '/discuss/:did', DiscussionDetailHandler);
    Route('discussion_edit', '/discuss/:did/edit', DiscussionEditHandler);
    Route('discussion_detail', '/discuss/:did/raw', DiscussionRawHandler);
    Route('discussion_reply_raw', '/discuss/:did/:drid/raw', DiscussionRawHandler);
    Route('discussion_tail_reply_raw', '/discuss/:did/:drid/:drrid/raw', DiscussionRawHandler);
    Route('discussion_node', '/discuss/:type/:name', DiscussionNodeHandler);
    Route('discussion_create', '/discuss/:type/:name/create', DiscussionCreateHandler, PRIV.PRIV_USER_PROFILE, PERM.PERM_CREATE_DISCUSSION);
}

global.Hydro.handler.discussion = apply;
