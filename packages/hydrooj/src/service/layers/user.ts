import { CsrfTokenError, NotFoundError } from 'hydrooj/src/error';
import avatar from 'hydrooj/src/lib/avatar';
import { PERM } from 'hydrooj/src/model/builtin';
import UserModel from 'hydrooj/src/model/user';
import type { KoaContext } from '../server';

export default async (ctx: KoaContext, next) => {
    // User Layer
    const { request, args, domain } = ctx.HydroContext;
    const domainId = domain ? args.domainId : 'system';
    let user = await UserModel.getById(domainId, ctx.session.uid, ctx.session.scope);
    if (!user) {
        ctx.session.uid = 0;
        ctx.session.scope = PERM.PERM_ALL.toString();
        user = await UserModel.getById(domainId, ctx.session.uid, ctx.session.scope);
    }
    if (user._id === 0) delete user.viewLang;
    user.avatarUrl = avatar(user.avatar, 128);
    ctx.HydroContext.user = user;
    if (!domain) throw new NotFoundError(args.domainId);
    if (request.method === 'post' && request.headers.referer) {
        const host = new URL(request.headers.referer).host;
        if (host !== request.host) throw new CsrfTokenError(host);
    }
    await next();
};
