import { IncomingMessage } from 'http';
import KoaRouter from 'koa-router';
import parseUrl from 'parseurl';
import { pathToRegexp } from 'path-to-regexp';
import tx2 from 'tx2';
import type WebSocket from 'ws';
import type { KoaContext } from './server';

type WebSocketCallback = (socket: WebSocket, request: IncomingMessage, ctx: KoaContext) => void;
const connCount = tx2.counter({ name: 'connections' });

export class WebSocketLayer {
    clients = new Set<WebSocket>();
    regexp: RegExp;

    constructor(private router: Router, path: Parameters<typeof pathToRegexp>[0], public callback?: WebSocketCallback) {
        this.regexp = pathToRegexp(path);
    }

    accept(socket: WebSocket, request: IncomingMessage, ctx: KoaContext) {
        if (!this.regexp.test(parseUrl(request).pathname)) return false;
        this.clients.add(socket);
        connCount.inc();
        socket.on('close', () => {
            connCount.dec();
            this.clients.delete(socket);
        });
        this.callback?.(socket, request, ctx);
        return true;
    }

    close() {
        for (const socket of this.clients) {
            socket.close();
        }
    }
}

export class Router extends KoaRouter {
    wsStack: WebSocketLayer[] = [];

    /**
     * hack into router methods to make sure that koa middlewares are disposable
     */
    register(...args: Parameters<KoaRouter['register']>) {
        const layer = super.register(...args);
        // TODO handle unregister
        return layer;
    }

    ws(path: Parameters<typeof pathToRegexp>[0], callback?: WebSocketCallback) {
        const layer = new WebSocketLayer(this, path, callback);
        this.wsStack.push(layer);
        // TODO handle unregistry
        return layer;
    }
}
