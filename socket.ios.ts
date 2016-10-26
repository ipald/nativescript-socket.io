'use strict';

declare var NSURL: any;
declare var SocketIOClient: any;
declare var SocketAckEmitter: any;

SocketIOClient;
SocketAckEmitter; // fixes issue with class attributes and function not being recognized

import * as helpers from "./helpers";


const debugNull = function(...args: Array<any>): void { };

function debugDefault(...args: Array<any>) {
    args = args.map((value) => {
        if (typeof value === 'object' && value) {
            try {
                value = JSON.stringify(value);
            } catch (e) {
                value = value.toString();
            }
        }
        return value;
    });
    args.unshift('nativescript-socket.io');
    console.log.apply(console, args);
}

let debug = debugNull;

export function enableDebug(debugFn: ((...args: Array<any>) => any) = debugDefault): void {
    debug = debugFn;
}

export function disableDebug(): void {
    debug = debugNull;
}


export function connect(uri: any, options?: any): Socket {
    let socket = new Socket(uri, options || {});
    socket.connect();
    return socket;
}

export class Socket {

    private ios: SocketIOClient;

    private _listenerMap = new Map();

    constructor(uri: string, options: Object = {}) {

        // let config = SocketIOClientConfiguration.alloc().init();

        let config = [];
        
        // TODO: convert options to config

        this.ios = SocketIOClient.alloc().initWithSocketURLConfig(NSURL.URLWithString(uri), config);

    }

    connect() {
        this.ios.connect();
    }

    disconnect() {
        this.ios.disconnect();
    }

    get connected(): boolean {
        return this.ios && this.ios.engine.connected;
    }

    on(event: string, callback: (...payload: Array<any> /*, ack?: Function */) => any) {
        let listener = function(data: Array<any>, ack: any) {
            let payload = helpers.deserialize(data);
            if (ack.ackNum === -1) {
                ack = null;
            }
            debug('on', event, payload, ack ? 'ack' : '');
            if (ack) {
                let _ack = function(...args) {
                    debug('on', event, 'ack', args);
                    args = args.map(helpers.serialize)
                    ack.with(args);
                };
                payload.push(_ack);
            }
            callback.apply(null, payload);
        };
        let listenerId = this.ios.onCallback(event, listener);
        this._listenerMap.set(callback, listenerId);
        return this;
    }

    off(event: string, listener?: Function) {
        debug('off', event, listener);
        if (listener) {
            let listenerId = this._listenerMap.get(listener);
            if (listenerId) {
                this.ios.offWithId(listenerId);
                this._listenerMap.delete(listener);
            }
        } else {
            this.ios.off(event);
        }
        return this;
    }

    emit(event: string, ...payload: Array<any> /*, ack?: Function */) {
        let ack = payload.pop();
        if (typeof ack === 'undefined') {
            ack = null;
        } else if (typeof ack !== 'function') {
            payload.push(ack);
            ack = null;
        }
        debug('emit', event, payload, ack ? 'ack' : '');
        payload = payload.map(helpers.serialize);
        if (ack) {
            let _ack = function(args) {
                args = helpers.deserialize(args);
                debug('emit', event, 'ack', args);
                ack.apply(null, args);
            };
            this.ios.emitWithAckWith(event, payload)(0, _ack);
        } else {
            this.ios.emitWith(event, payload);
        }
    }

}

