import type fs from 'fs';
import type { Dictionary, NumericDictionary } from 'lodash';
import type { ItemBucketMetadata } from 'minio';
import type { Cursor, ObjectID } from 'mongodb';
import type { ProblemDoc } from './model/problem';

type document = typeof import('./model/document');

export interface System {
    _id: string,
    value: any,
}

export interface SystemKeys {
    'file.endPoint': string,
    'file.accessKey': string,
    'file.secretKey': string,
    'file.bucket': string,
    'file.region': string,
    'file.pathStyle': boolean,
    'file.endPointForUser': string,
    'file.endPointForJudge': string,
    'smtp.user': string,
    'smtp.from': string,
    'smtp.pass': string,
    'smtp.host': string,
    'smtp.port': number,
    'smtp.secure': boolean,
    'installid': string,
    'server.name': string,
    'server.url': string,
    'server.xff': string,
    'server.xhost': string,
    'server.port': number,
    'server.language': string,
    'limit.problem_files_max': number,
    'problem.categories': string,
    'session.keys': string[],
    'session.secure': boolean,
    'session.saved_expire_seconds': number,
    'session.unsaved_expire_seconds': number,
    'user.quota': number,
}

export interface Setting {
    family: string,
    key: string,
    range: [string, string][] | Record<string, string>,
    value: any,
    type: string,
    subType?: string,
    name: string,
    desc: string,
    flag: number,
}

export interface OAuthUserResponse {
    _id: string;
    email: string;
    avatar?: string;
    bio?: string;
    uname?: string[];
    viewLang?: string;
}

export interface Udoc extends Dictionary<any> {
    _id: number;
    mail: string;
    mailLower: string;
    uname: string;
    unameLower: string;
    salt: string;
    hash: string;
    hashType: string;
    priv: number;
    regat: Date;
    loginat: Date;
    ip: string[];
    loginip: string;
}

export interface VUdoc {
    _id: number;
    mail: string;
    mailLower: string;
    uname: string;
    unameLower: string;
    salt: '';
    hash: '';
    hashType: 'hydro';
    priv: 0;
    regat: Date;
    loginat: Date;
    ip: ['127.0.0.1'];
    loginip: '127.0.0.1';
}

export interface GDoc {
    _id: ObjectID;
    domainId: string;
    name: string;
    uids: number[];
}

export interface UserPreferenceDoc {
    _id: ObjectID;
    filename: string;
    uid: number;
    content: string;
}

export type ownerInfo = { owner: number, maintainer?: number[] };

export type User = import('./model/user').User;
export type Udict = NumericDictionary<User>;

export interface FileInfo {
    /** storage path */
    _id: string,
    /** filename */
    name: string,
    /** file size (in bytes) */
    size: number,
    etag: string,
    lastModified: Date,
}

export interface TestCaseConfig {
    input: string;
    output: string;
    time?: string;
    memory?: string;
    score?: number;
}

export enum ProblemType {
    Default = 'default',
    SubmitAnswer = 'submit_answer',
    Interactive = 'interactive',
    Objective = 'objective',
}

export enum SubtaskType {
    min = 'min',
    max = 'max',
    sum = 'sum',
}

export interface SubtaskConfig {
    time?: string;
    memory?: string;
    score?: number;
    if?: number[];
    id?: number;
    type?: SubtaskType;
    cases?: TestCaseConfig[];
}

export interface ProblemConfigFile {
    type?: ProblemType;
    subType?: string;
    target?: string;
    score?: number;
    time?: string;
    memory?: string;
    filename?: string;
    checker_type?: string;
    checker?: string;
    interactor?: string;
    user_extra_files?: string[];
    judge_extra_files?: string[];
    detail?: boolean;
    outputs?: [string, number][];
    redirect?: string;
    cases?: TestCaseConfig[];
    subtasks?: SubtaskConfig[];
    langs?: string[];
}

export interface ProblemConfig {
    redirect?: [string, string];
    count: number;
    memoryMax: number;
    memoryMin: number;
    timeMax: number;
    timeMin: number;
    langs?: string[];
    type: string;
    subType?: string;
    target?: string;
}

export interface PlainContentNode {
    type: 'Plain',
    subType: 'html' | 'markdown',
    text: string,
}
export interface TextContentNode {
    type: 'Text',
    subType: 'html' | 'markdown',
    sectionTitle: string,
    text: string,
}
export interface SampleContentNode {
    type: 'Sample',
    text: string,
    sectionTitle: string,
    payload: [string, string],
}
// TODO drop contentNode support
export type ContentNode = PlainContentNode | TextContentNode | SampleContentNode;
export type Content = string | ContentNode[] | Record<string, ContentNode[]>;

export interface Document {
    _id: ObjectID;
    docId: any;
    docType: number;
    domainId: string;
    owner: number;
    maintainer?: number[];
}

declare module './model/problem' {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    interface ProblemDoc {
        docType: document['TYPE_PROBLEM'];
        docId: number;
        pid: string;
        title: string;
        content: string;
        nSubmit: number;
        nAccept: number;
        tag: string[];
        data: FileInfo[];
        additional_file: FileInfo[];
        hidden?: boolean;
        assign: string[];
        html?: boolean;
        stats?: any;
        difficulty?: number;
        sort?: string;
        reference?: {
            domainId: string;
            pid: number;
        };

        /** string (errormsg) */
        config: string | ProblemConfig;
    }
}
export type { ProblemDoc } from './model/problem';
export type ProblemDict = NumericDictionary<ProblemDoc>;

export interface StatusDoc {
    _id: ObjectID,
    docId: any,
    docType: number,
    domainId: string,
    uid: number,
}

export interface ProblemStatusDoc extends StatusDoc {
    docId: number;
    docType: 10;
    rid?: ObjectID;
    score?: number;
    status?: number;
    nSubmit?: number;
    nAccept?: number;
    star?: boolean;
}

export interface TestCase {
    id?: number;
    subtaskId?: number;
    score?: number;
    time: number;
    memory: number;
    status: number;
    message: string;
}

export interface RecordDoc {
    _id: ObjectID;
    domainId: string;
    pid: number;
    uid: number;
    lang: string;
    code: string;
    score: number;
    memory: number;
    time: number;
    judgeTexts: (string | JudgeMessage)[];
    compilerTexts: string[];
    testCases: Required<TestCase>[];
    rejudged: boolean;
    source?: string;
    /** judge uid */
    judger: number;
    judgeAt: Date;
    status: number;
    progress?: number;
    /** pretest */
    input?: string;
    /** 0 if pretest&script */
    contest?: ObjectID;
}

export interface ScoreboardNode {
    type: 'string' | 'rank' | 'user' | 'email' | 'record' | 'records' | 'problem' | 'solved' | 'time' | 'total_score';
    value: string;
    raw?: any;
    score?: number;
    style?: string;
    hover?: string;
}
export type ScoreboardRow = ScoreboardNode[] & { raw?: any };

export type PenaltyRules = Dictionary<number>;

export interface TrainingNode {
    _id: number,
    title: string,
    requireNids: number[],
    pids: number[],
}

export interface Tdoc<docType = document['TYPE_CONTEST'] | document['TYPE_TRAINING']> extends Document {
    docId: ObjectID;
    docType: docType & number;
    beginAt: Date;
    endAt: Date;
    attend: number;
    title: string;
    content: string;
    rule: string;
    pids: number[];
    rated?: boolean;
    _code?: string;
    assign?: string[];

    // For contest
    lockAt?: Date;
    /**
     * In hours
     * 在比赛有效时间内选择特定的 X 小时参加比赛（从首次打开比赛算起）
     */
    duration: number;

    // For homework
    penaltySince?: Date;
    penaltyRules?: PenaltyRules;

    // For training
    description?: string;
    dag?: TrainingNode[];
}

export interface TrainingDoc extends Tdoc {
    description: string;
    pin?: boolean;
    dag: TrainingNode[];
}

export interface DomainDoc extends Record<string, any> {
    _id: string,
    owner: number,
    roles: Dictionary<string>,
    avatar: string,
    bulletin: string,
    _join?: any,
    host?: string[],
}

export interface DomainUnion {
    _id: string;
    union: string[];
    problem: boolean;
}

// Message
export interface MessageDoc {
    _id: ObjectID,
    from: number,
    to: number,
    content: string,
    flag: number,
}

// Blacklist
export interface BlacklistDoc {
    /**
     * @example ip:1.1.1.1
     * @example mail:foo.com
     */
    _id: string;
    expireAt: Date;
}

export interface HistoryDoc {
    content: string;
    time: Date;
}

// Discussion
export type { DiscussionDoc } from './model/discussion';
declare module './model/discussion' {
    interface DiscussionDoc {
        docType: document['TYPE_DISCUSSION'];
        docId: ObjectID;
        parentType: number;
        parentId: ObjectID | number | string;
        title: string;
        content: string;
        ip: string;
        pin: boolean;
        highlight: boolean;
        updateAt: Date;
        nReply: number;
        views: number;
        history: HistoryDoc[];
        react: Record<string, number>;
        sort: number;
        lastRCount: number;
        lock?: boolean;
    }
}

export interface DiscussionReplyDoc extends Document {
    docType: document['TYPE_DISCUSSION_REPLY'];
    docId: ObjectID;
    parentType: document['TYPE_DISCUSSION'];
    parentId: ObjectID;
    ip: string;
    content: string;
    reply: DiscussionTailReplyDoc[];
    history: HistoryDoc[];
    react: Record<string, number>;
}

export interface DiscussionTailReplyDoc {
    _id: ObjectID,
    owner: number,
    content: string,
    ip: string,
    history: HistoryDoc[],
}

export interface BlogDoc {
    docType: document['TYPE_BLOG'];
    docId: ObjectID;
    owner: number;
    title: string;
    content: string;
    ip: string;
    updateAt: Date;
    nReply: number;
    views: number;
    reply: any[];
    react: Record<string, number>;
}

export interface TokenDoc {
    _id: string,
    tokenType: number,
    createAt: Date,
    updateAt: Date,
    expireAt: Date,
    [key: string]: any,
}

export interface OplogDoc extends Record<string, any> {
    _id: ObjectID,
    type: string,
}

export interface ContestStat extends Record<string, any> {
    detail: any,
}

export interface ContestRule<T = any> {
    _originalRule?: Partial<ContestRule<T>>;
    TEXT: string;
    check: (args: any) => any;
    statusSort: any;
    submitAfterAccept: boolean;
    showScoreboard: (tdoc: Tdoc<30>, now: Date) => boolean;
    showSelfRecord: (tdoc: Tdoc<30>, now: Date) => boolean;
    showRecord: (tdoc: Tdoc<30>, now: Date) => boolean;
    stat: (this: ContestRule<T>, tdoc: Tdoc<30>, journal: any[], ignoreLock?: boolean) => ContestStat & T;
    scoreboard: (
        this: ContestRule<T>, isExport: boolean, _: (s: string) => string,
        tdoc: Tdoc<30>, pdict: ProblemDict, cursor: Cursor<ContestStat & T>, page: number,
    ) => Promise<[board: ScoreboardRow[], udict: Udict, nPages: number]>;
    ranked: (tdoc: Tdoc<30>, cursor: Cursor<ContestStat & T>) => Promise<[Array<[number, ContestStat & T]>, number]>;
}

export type ContestRules = Dictionary<ContestRule>;
export type ProblemImporter = (url: string, handler: any) => Promise<[ProblemDoc, fs.ReadStream?]> | [ProblemDoc, fs.ReadStream?];

export interface Script {
    run: (args: any, report: Function) => any,
    description: string,
    validate: any,
}

export interface JudgeMessage {
    message: string;
    params?: string[];
    stack?: string;
}

export interface JudgeResultBody {
    key: string;
    domainId: string;
    rid: ObjectID;
    judger?: number;
    progress?: number;
    addProgress?: number;
    case?: TestCase,
    status?: number;
    score?: number;
    time?: number;
    memory?: number;
    message?: string | JudgeMessage;
    compilerText?: string,
}

export interface Task {
    _id: ObjectID;
    type: string;
    subType?: string;
    executeAfter: Date;
    priority: number;
    [key: string]: any;
}

export interface BaseService {
    started: boolean;
    error?: Error | string;
    start: Function;
    stop?: Function;
}

export interface FileNode {
    /** File Path In MinIO */
    _id: string;
    /** Actual File Path */
    path: string;
    lastUsage?: Date;
    lastModified?: Date;
    etag?: string;
    /** Size: in bytes */
    size?: number;
    /** AutoDelete */
    autoDelete?: Date;
    owner?: number;
    operator?: number[];
    meta?: ItemBucketMetadata;
}

export interface EventDoc {
    ack: string[];
    event: number | string;
    payload: string;
    expire: Date;
}

export interface OpCountDoc {
    _id: ObjectID;
    op: string;
    ident: string;
    expireAt: Date;
    opcount: number;
}

export interface Collections {
    'blacklist': BlacklistDoc;
    'contest': Tdoc;
    'domain': DomainDoc;
    'domain.user': any;
    'domain.union': DomainUnion;
    'record': RecordDoc;
    'document': any;
    'document.status': any;
    'problem': ProblemDoc;
    'user': Udoc;
    'user.preference': UserPreferenceDoc;
    'vuser': VUdoc;
    'user.group': GDoc;
    'check': any;
    'message': MessageDoc;
    'token': TokenDoc;
    'status': any;
    'oauth': any;
    'system': System;
    'task': Task;
    'storage': FileNode;
    'oplog': OplogDoc;
    'event': EventDoc;
    'opcount': OpCountDoc;
    'log': any;
    'fs.chunks': any;
    'fs.files': any;
}

export interface Model {
    blacklist: typeof import('./model/blacklist').default,
    blog: typeof import('./model/blog'),
    builtin: typeof import('./model/builtin'),
    contest: typeof import('./model/contest'),
    discussion: typeof import('./model/discussion'),
    document: typeof import('./model/document'),
    domain: typeof import('./model/domain').default,
    message: typeof import('./model/message').default,
    opcount: typeof import('./model/opcount'),
    problem: typeof import('./model/problem').default,
    record: typeof import('./model/record').default,
    setting: typeof import('./model/setting'),
    solution: typeof import('./model/solution').default,
    system: typeof import('./model/system'),
    task: typeof import('./model/task').default,
    oplog: typeof import('./model/oplog'),
    token: typeof import('./model/token').default,
    training: typeof import('./model/training'),
    user: typeof import('./model/user').default,
    oauth: typeof import('./model/oauth').default,
    storage: typeof import('./model/storage').default,
    rp: typeof import('./script/rating').RpTypes,
}

export interface Service {
    bus: typeof import('./service/bus'),
    db: typeof import('./service/db'),
    monitor: typeof import('./service/monitor'),
    server: typeof import('./service/server'),
    storage: typeof import('./service/storage'),
}

export interface GeoIP {
    provider: string,
    lookup: (ip: string, locale?: string) => any,
}

export interface ProblemSearchResponse {
    hits: string[];
    total: number;
    countRelation: 'eq' | 'gte';
}
export interface ProblemSearchOptions {
    limit?: number;
    skip?: number;
}

export type ProblemSearch = (domainId: string, q: string, options?: ProblemSearchOptions) => Promise<ProblemSearchResponse>;

export interface Lib extends Record<string, any> {
    download: typeof import('./lib/download'),
    difficulty: typeof import('./lib/difficulty'),
    buildContent: typeof import('./lib/content').buildContent,
    'hash.hydro': typeof import('./lib/hash.hydro'),
    i18n: typeof import('./lib/i18n'),
    jwt: typeof import('./lib/jwt'),
    mail: typeof import('./lib/mail'),
    md5: typeof import('./lib/crypto').md5,
    sha1: typeof import('./lib/crypto').sha1,
    misc: typeof import('./lib/misc'),
    paginate: typeof import('./lib/paginate'),
    rank: typeof import('./lib/rank'),
    rating: typeof import('./lib/rating'),
    testdataConfig: typeof import('./lib/testdataConfig'),
    useragent: typeof import('./lib/useragent'),
    validator: typeof import('./lib/validator'),
    template?: any,
    geoip?: GeoIP,
    problemSearch: ProblemSearch;
}

export interface UI {
    manifest: Dictionary<string>,
    template: Dictionary<string>,
    nodes: {
        nav: any[],
        problem_add: any[],
        user_dropdown: any[],
    },
    Nav: typeof import('./lib/ui').Nav,
    ProblemAdd: typeof import('./lib/ui').ProblemAdd,
    UserDropdown: typeof import('./lib/ui').UserDropdown,
}

export interface HydroGlobal {
    version: Record<string, string>,
    model: Model,
    handler: Record<string, Function>,
    script: Record<string, Script>,
    service: Service,
    lib: Lib,
    stat: any,
    ui: UI,
    error: typeof import('./error'),
    Logger: typeof import('./logger').Logger,
    logger: typeof import('./logger').logger,
    locales: Record<string, Record<string, string>>,
}

declare global {
    namespace NodeJS {
        interface Global {
            Hydro: HydroGlobal,
            addons: string[],
        }
    }
    var Hydro: HydroGlobal; // eslint-disable-line
    var addons: string[]; // eslint-disable-line
}
