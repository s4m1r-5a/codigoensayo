'use strict';

var console$1 = require('console');
var require$$3$1 = require('fs');
var node_events = require('node:events');
var crypto = require('crypto');
var require$$0$4 = require('tty');
var require$$0$6 = require('url');
var require$$1$3 = require('http');
var require$$2$1 = require('https');
var require$$1$2 = require('stream');
var require$$4$1 = require('assert');
var require$$1$1 = require('util');
var require$$0$5 = require('os');
var path = require('path');
var ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
var ffmpeg = require('fluent-ffmpeg');
var require$$4$2 = require('net');
var require$$0$7 = require('events');
var require$$3$2 = require('zlib');
var require$$0$8 = require('buffer');
var require$$1$4 = require('string_decoder');
var require$$8 = require('querystring');

class EventEmitterClass {
    constructor() {
        this.emitter = new node_events.EventEmitter();
    }
    emit(eventName, ...eventArg) {
        this.emitter.emit(eventName, ...eventArg);
    }
    on(eventName, handler) {
        this.emitter.on(eventName, handler);
    }
    off(eventName, handler) {
        this.emitter.off(eventName, handler);
    }
}

class GlobalState {
    constructor() {
        /**
         * Updates the global state with the provided key-value pairs.
         * @param keyValue - An object containing the key-value pairs to update the state with.
         * @returns A function that updates the state when called.
         */
        this.updateState = () => {
            return (keyValue) => new Promise((resolve) => {
                const currentStateByFrom = this.STATE.get('__global__');
                const updatedState = { ...currentStateByFrom, ...keyValue };
                this.STATE.set('__global__', updatedState);
                resolve();
            });
        };
        /**
         * Retrieves the global state.
         * @returns A function that returns the global state when called.
         */
        this.getMyState = () => {
            return () => this.STATE.get('__global__');
        };
        /**
         * Retrieves a specific property from the global state.
         * @returns A function that returns the value of the specified property when called.
         */
        this.get = () => {
            return (prop) => this.STATE.get('__global__')?.[prop];
        };
        /**
         * Retrieves all state values.
         * @returns An iterator for the values of the state.
         */
        this.getAllState = () => this.STATE.values();
        /**
         * Clears the global state.
         * @returns A function that clears the global state when called.
         */
        this.clear = () => {
            return () => this.STATE.set('__global__', {});
        };
        this.STATE = new Map();
        this.STATE.set('__global__', {});
        this.RAW = {};
    }
}

class SingleState {
    constructor() {
        this.STATE = new Map();
        /**
         * Updates the state for a given context.
         * @param ctx - The context for which to update the state.
         * @returns A function that takes a key-value object to update the state.
         */
        this.updateState = (ctx = { from: '' }) => {
            return (keyValue) => {
                return new Promise((resolve) => {
                    const currentStateByFrom = this.STATE.get(ctx.from) || {};
                    const updatedState = { ...currentStateByFrom, ...keyValue };
                    this.STATE.set(ctx.from, updatedState);
                    resolve();
                });
            };
        };
        /**
         * Retrieves the state for a given context.
         * @param from - The identifier for the context.
         * @returns A function that returns the state.
         */
        this.getMyState = (from) => {
            return () => this.STATE.get(from);
        };
        /**
         * Retrieves a specific property from the state of a given context.
         * @param from - The identifier for the context.
         * @returns A function that takes a property name and returns its value.
         */
        this.get = (from) => {
            return (prop) => this.STATE.get(from)?.[prop];
        };
        /**
         * Retrieves all states.
         * @returns An iterator for the values of the state map.
         */
        this.getAllState = () => this.STATE.values();
        /**
         * Clears the state for a given context.
         * @param from - The identifier for the context.
         * @returns A function that clears the state.
         */
        this.clear = (from) => {
            return () => this.STATE.delete(from);
        };
        /**
         *
         * @returns
         */
        this.clearAll = () => this.STATE.clear();
    }
}

class IdleState {
    constructor() {
        this.indexCb = new Map();
        /**
         *
         * @param param0
         */
        this.setIdleTime = ({ from, inRef, timeInSeconds, cb }) => {
            cb = cb ?? (() => { });
            const startTime = new Date().getTime();
            const endTime = startTime + timeInSeconds * 1000;
            if (!this.indexCb.has(from))
                this.indexCb.set(from, []);
            const queueCb = this.indexCb.get(from);
            const interval = setInterval(() => {
                const internalTime = new Date().getTime();
                if (internalTime > endTime) {
                    cb({ next: true, inRef });
                    const map = this.indexCb.get(from) ?? [];
                    const index = map.findIndex((o) => o.inRef === inRef);
                    clearInterval(interval);
                    map.splice(index, 1);
                }
            }, 1000);
            queueCb.push({
                from,
                inRef,
                cb,
                stop: (ctxInComing) => {
                    clearInterval(interval);
                    cb({ ...ctxInComing, next: false, inRef });
                },
            });
        };
        /**
         *
         * @param param0
         * @returns
         */
        this.get = ({ from, inRef }) => {
            try {
                const queueCb = this.indexCb.get(from) ?? [];
                const isHas = queueCb.findIndex((i) => i.inRef !== inRef) !== -1;
                return isHas;
            }
            catch (err) {
                console.error(`Error Get ctxInComming: `, err);
                return null;
            }
        };
        /**
         *
         * @param ctxInComing
         */
        this.stop = (ctxInComing) => {
            try {
                const queueCb = this.indexCb.get(ctxInComing.from) ?? [];
                for (const iterator of queueCb) {
                    iterator.stop(ctxInComing);
                }
                this.indexCb.set(ctxInComing.from, []);
            }
            catch (err) {
                console.error(err);
            }
        };
    }
}

const SALT_KEY = `sal-key-${Date.now()}`;
const SALT_IV = `sal-iv-${Date.now()}`;
const METHOD = 'aes-256-cbc';
const key = crypto.createHash('sha512').update(SALT_KEY).digest('hex').substring(0, 32);
const encryptionIV = crypto.createHash('sha512').update(SALT_IV).digest('hex').substring(0, 16);
/**
 * Genera un UUID único con posibilidad de tener un prefijo.
 * @param prefix Prefijo opcional para el UUID.
 * @returns El UUID generado.
 */
const generateRef = (prefix) => {
    const id = crypto.randomUUID();
    return prefix ? `${prefix}_${id}` : id;
};
/**
 * Genera un timestamp en milisegundos sin prefijo hex.
 * @returns El timestamp generado.
 */
const generateTime = () => {
    return Date.now();
};
/**
 * Genera un HASH MD5 a partir de un objeto serializado como cadena JSON.
 * @param param0 Objeto con propiedades index, answer y keyword.
 * @returns El HASH MD5 generado.
 */
const generateRefSerialize = ({ index, answer, keyword, }) => {
    return crypto.createHash('md5').update(JSON.stringify({ index, answer, keyword })).digest('hex');
};
/**
 * Generamos un UUID único con posibilidad de tener un prefijo
 * @param prefix - Prefijo opcional para el UUID
 * @returns Un UUID único, opcionalmente con prefijo
 */
const generateRefProvider = (prefix) => {
    const id = crypto.randomUUID();
    return prefix ? `${prefix}_${id}` : id;
};
/**
 * Encriptar data
 * @param data - Datos a encriptar
 * @returns Datos encriptados en base64
 */
const encryptData = (data) => {
    const cipher = crypto.createCipheriv(METHOD, key, encryptionIV);
    return Buffer.from(cipher.update(data, 'utf8', 'hex') + cipher.final('hex')).toString('base64');
};
/**
 * Desencriptar data
 * @param encryptedData - Datos encriptados en base64
 * @returns Datos desencriptados o 'FAIL' en caso de error
 */
const decryptData = (encryptedData) => {
    try {
        const buff = Buffer.from(encryptedData, 'base64');
        const decipher = crypto.createDecipheriv(METHOD, key, encryptionIV);
        return decipher.update(buff.toString('utf8'), 'hex', 'utf8') + decipher.final('utf8');
    }
    catch (e) {
        console.error(e);
        return 'FAIL';
    }
};
/**
 *
 * @param prefix
 * @returns
 */
const generateRegex = (prefix) => {
    return new RegExp(`^${prefix}__[\\w\\d]{8}-(?:[\\w\\d]{4}-){3}[\\w\\d]{12}$`);
};

const eventAction = () => {
    return generateRef('_event_action_');
};

const REGEX_EVENT_CUSTOM = /^_event_custom__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/;

const eventDocument = () => {
    return generateRef('_event_document_');
};
const REGEX_EVENT_DOCUMENT = generateRegex(`_event_document`);

const eventLocation = () => {
    return generateRef('_event_location_');
};
const REGEX_EVENT_LOCATION = generateRegex(`_event_location`);

const eventMedia = () => {
    return generateRef('_event_media_');
};
const REGEX_EVENT_MEDIA = generateRegex(`_event_media`);

const eventOrder = () => {
    return generateRef('_event_order_');
};
const REGEX_EVENT_ORDER = generateRegex(`_event_order`);

const eventTemplate = () => {
    return generateRef('_event_template_');
};
const REGEX_EVENT_TEMPLATE = generateRegex(`_event_template`);

const eventVoiceNote = () => {
    return generateRef('_event_voice_note_');
};
const REGEX_EVENT_VOICE_NOTE = generateRegex(`_event_voice_note`);

const eventWelcome = () => {
    return generateRef('_event_welcome_');
};

const LIST_ALL = {
    WELCOME: eventWelcome(),
    MEDIA: eventMedia(),
    LOCATION: eventLocation(),
    DOCUMENT: eventDocument(),
    VOICE_NOTE: eventVoiceNote(),
    ACTION: eventAction(),
    ORDER: eventOrder(),
    TEMPLATE: eventTemplate(),
};
const LIST_REGEX = {
    REGEX_EVENT_DOCUMENT,
    REGEX_EVENT_LOCATION,
    REGEX_EVENT_MEDIA,
    REGEX_EVENT_VOICE_NOTE,
    REGEX_EVENT_ORDER,
    REGEX_EVENT_TEMPLATE,
    REGEX_EVENT_CUSTOM,
};

/**
 * Crear referencia serializada
 * @param flowJson - Array de objetos que se van a serializar.
 * @returns Array de objetos serializados.
 */
const toSerialize = (flowJson) => {
    if (!Array.isArray(flowJson))
        throw new Error('Esto debe ser un ARRAY');
    const jsonToSerialize = flowJson.map((row, index) => ({
        ...row,
        refSerialize: generateRefSerialize({
            index,
            keyword: row.keyword,
            answer: row.answer,
        }),
    }));
    return jsonToSerialize;
};

/**
 * @private
 * @param answer - This parameter is not used in the function body and can be removed.
 * @param options - This parameter is not used in the function body and can be removed.
 * @returns Serialized flow object
 */
const addChild = (flowIn = null) => {
    if (!flowIn?.toJson) {
        throw new Error('DEBE SER UN FLOW CON toJSON()');
    }
    return toSerialize(flowIn.toJson());
};

const toJson = (inCtx) => {
    const lastCtx = inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx;
    return () => lastCtx.json;
};

/**
 * Convierte una lista de objetos anidados en un objeto plano,
 * utilizando las funciones de devolución de llamada proporcionadas.
 * @param listArray Lista de objetos anidados.
 * @returns Objeto plano resultante.
 */
const flatObject = (listArray = []) => {
    const cbNestedList = Array.isArray(listArray) ? listArray : [];
    if (!cbNestedList.length)
        return {};
    const cbNestedObj = cbNestedList.map(({ ctx }) => ctx?.callbacks).filter(Boolean);
    const flatObj = cbNestedObj.reduce((acc, current) => {
        const keys = Object.keys(current);
        const values = Object.values(current);
        keys.forEach((key, i) => {
            acc[key] = values[i];
        });
        return acc;
    }, {});
    return flatObj;
};

/**
 * @public
 * @param inCtx
 * @returns
 */
const _addAnswer = (inCtx) => (answer, options, cb, nested) => {
    const lastCtx = ('ctx' in inCtx ? inCtx.ctx : inCtx);
    nested = nested ?? [];
    answer = Array.isArray(answer) ? answer.join('\n') : answer;
    const getAnswerOptions = () => ({
        media: typeof options?.media === 'string' ? options.media : undefined,
        buttons: Array.isArray(options?.buttons) ? options.buttons : [],
        capture: typeof options?.capture === 'boolean' ? options.capture : false,
        delay: typeof options?.delay === 'number' ? options.delay : 0,
        idle: typeof options?.idle === 'number' ? options.idle : undefined,
        ref: typeof options?.ref === 'string' ? options.ref : undefined,
    });
    const getNested = () => {
        let flatNested = [];
        if (Array.isArray(nested)) {
            for (const iterator of nested) {
                flatNested = [...flatNested, ...addChild(iterator)];
            }
            return {
                nested: flatNested,
            };
        }
        return {
            nested: addChild(nested),
        };
    };
    const getCbFromNested = () => {
        const nestedArray = Array.isArray(nested) ? nested : [nested];
        return flatObject(nestedArray);
    };
    const callback = typeof cb === 'function' ? cb : () => { };
    const ctxAnswer = () => {
        const options = {
            ...getAnswerOptions(),
            ...getNested(),
            keyword: {},
            callback: !!cb,
        };
        const ref = options.ref ?? `ans_${generateRef()}`;
        const json = [].concat(lastCtx.json).concat([
            {
                ref,
                keyword: lastCtx.ref,
                answer,
                options,
            },
        ]);
        const callbacks = {
            ...lastCtx.callbacks,
            ...getCbFromNested(),
            [ref]: callback,
        };
        return {
            ...lastCtx,
            ref,
            answer,
            json,
            options,
            callbacks,
        };
    };
    const ctx = ctxAnswer();
    /**
     * addAnswer: _addAnswer(ctx),
     * TODO esto es un demo solo he agregado addMessage
     */
    return {
        ctx,
        ref: ctx.ref,
        // addAnswer: _addAnswer(ctx),
        addAnswer: (answer, options, cb, nested) => {
            return _addAnswer(ctx)(answer, { ...options, capture: false }, null).addAction(options, cb, nested);
        },
        addAction: (cb = () => { }, flagCb = () => { }, nested) => {
            if (typeof cb === 'object')
                return _addAnswer(ctx)('__capture_only_intended__', cb, flagCb, nested);
            return _addAnswer(ctx)('__call_action__', null, cb, nested);
        },
        toJson: toJson(ctx),
    };
};

/**
 * @public
 * @param keyword
 * @param options
 * @returns
 */
const addKeyword = (keyword, options) => {
    if (typeof keyword !== 'string' && !Array.isArray(keyword)) {
        throw new Error('DEBE_SER_STRING_ARRAY_REGEX');
    }
    const parseOptions = () => {
        const defaultProperties = {
            sensitive: typeof options?.sensitive === 'boolean' ? !!options?.sensitive : false,
            regex: typeof options?.regex === 'boolean' ? !!options?.regex : false,
        };
        return defaultProperties;
    };
    const ctxAddKeyword = () => {
        const ref = `key_${generateRef()}`;
        const parsedOptions = parseOptions();
        const json = [
            {
                ref,
                keyword,
                options: parsedOptions,
            },
        ];
        return { ref, keyword, options: parsedOptions, json };
    };
    const ctx = ctxAddKeyword();
    return {
        ctx,
        ref: ctx.ref,
        addAnswer: _addAnswer(ctx),
        addAction: (cb = () => null, flagCb = () => null) => {
            if (typeof cb === 'object') {
                return _addAnswer(ctx)('__capture_only_intended__', cb, flagCb);
            }
            return _addAnswer(ctx)('__call_action__', null, cb);
        },
        toJson: toJson(ctx),
    };
};

/**
 * @param params ToCtxParams
 * @returns Context
 */
const toCtx = ({ body, from, prevRef, keyword, options = {}, index }) => {
    return {
        ref: generateRef(),
        keyword: prevRef ?? keyword,
        answer: body,
        options: options,
        from,
        refSerialize: generateRefSerialize({ index, answer: body }),
    };
};

class BlackList {
    constructor(initialNumbers = []) {
        this.blacklist = new Set();
        this.add(initialNumbers);
    }
    add(phoneNumbers) {
        const responseMessages = [];
        phoneNumbers = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
        phoneNumbers.flat().forEach((number) => {
            if (this.blacklist.has(number)) {
                responseMessages.push(`El número de teléfono ${number} ya está en la lista negra.`);
            }
            else {
                this.blacklist.add(number);
                responseMessages.push(`Número ${number} añadido exitosamente.`);
            }
        });
        return responseMessages;
    }
    remove(phoneNumber) {
        if (!this.blacklist.has(phoneNumber)) {
            throw new Error(phoneNumber);
        }
        this.blacklist.delete(phoneNumber);
    }
    checkIf(phoneNumber) {
        return this.blacklist.has(phoneNumber);
    }
    getList() {
        return Array.from(this.blacklist);
    }
}

/**
 * A utility function that introduces a delay in execution.
 * @param milliseconds - The duration of the delay in milliseconds.
 * @returns A Promise that resolves after the specified delay.
 */
const delay = (milliseconds) => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
	if (typeof f == "function") {
		var a = function a () {
			if (this instanceof a) {
        return Reflect.construct(f, arguments, this.constructor);
			}
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var picocolors = {exports: {}};

let tty = require$$0$4;

let isColorSupported =
	!("NO_COLOR" in process.env || process.argv.includes("--no-color")) &&
	("FORCE_COLOR" in process.env ||
		process.argv.includes("--color") ||
		process.platform === "win32" ||
		(tty.isatty(1) && process.env.TERM !== "dumb") ||
		"CI" in process.env);

let formatter =
	(open, close, replace = open) =>
	input => {
		let string = "" + input;
		let index = string.indexOf(close, open.length);
		return ~index
			? open + replaceClose(string, close, replace, index) + close
			: open + string + close
	};

let replaceClose = (string, close, replace, index) => {
	let start = string.substring(0, index) + replace;
	let end = string.substring(index + close.length);
	let nextIndex = end.indexOf(close);
	return ~nextIndex ? start + replaceClose(end, close, replace, nextIndex) : start + end
};

let createColors = (enabled = isColorSupported) => ({
	isColorSupported: enabled,
	reset: enabled ? s => `\x1b[0m${s}\x1b[0m` : String,
	bold: enabled ? formatter("\x1b[1m", "\x1b[22m", "\x1b[22m\x1b[1m") : String,
	dim: enabled ? formatter("\x1b[2m", "\x1b[22m", "\x1b[22m\x1b[2m") : String,
	italic: enabled ? formatter("\x1b[3m", "\x1b[23m") : String,
	underline: enabled ? formatter("\x1b[4m", "\x1b[24m") : String,
	inverse: enabled ? formatter("\x1b[7m", "\x1b[27m") : String,
	hidden: enabled ? formatter("\x1b[8m", "\x1b[28m") : String,
	strikethrough: enabled ? formatter("\x1b[9m", "\x1b[29m") : String,
	black: enabled ? formatter("\x1b[30m", "\x1b[39m") : String,
	red: enabled ? formatter("\x1b[31m", "\x1b[39m") : String,
	green: enabled ? formatter("\x1b[32m", "\x1b[39m") : String,
	yellow: enabled ? formatter("\x1b[33m", "\x1b[39m") : String,
	blue: enabled ? formatter("\x1b[34m", "\x1b[39m") : String,
	magenta: enabled ? formatter("\x1b[35m", "\x1b[39m") : String,
	cyan: enabled ? formatter("\x1b[36m", "\x1b[39m") : String,
	white: enabled ? formatter("\x1b[37m", "\x1b[39m") : String,
	gray: enabled ? formatter("\x1b[90m", "\x1b[39m") : String,
	bgBlack: enabled ? formatter("\x1b[40m", "\x1b[49m") : String,
	bgRed: enabled ? formatter("\x1b[41m", "\x1b[49m") : String,
	bgGreen: enabled ? formatter("\x1b[42m", "\x1b[49m") : String,
	bgYellow: enabled ? formatter("\x1b[43m", "\x1b[49m") : String,
	bgBlue: enabled ? formatter("\x1b[44m", "\x1b[49m") : String,
	bgMagenta: enabled ? formatter("\x1b[45m", "\x1b[49m") : String,
	bgCyan: enabled ? formatter("\x1b[46m", "\x1b[49m") : String,
	bgWhite: enabled ? formatter("\x1b[47m", "\x1b[49m") : String,
});

picocolors.exports = createColors();
picocolors.exports.createColors = createColors;

var picocolorsExports = picocolors.exports;
var color = /*@__PURE__*/getDefaultExportFromCjs(picocolorsExports);

const NODE_ENV = process.env.NODE_ENV || 'dev';
/**
 *
 * @param message
 * @param title
 * @param cName
 */
const printer = (message, title, cName) => {
    if (NODE_ENV !== 'test') {
        cName = cName ?? 'bgRed';
        if (title.length)
            console.log(color[cName](`${title}`));
        console.log(color.yellow(Array.isArray(message) ? message.join('\n') : message));
        console.log(``);
    }
};

class Queue {
    constructor(logger, concurrencyLimit = 15, timeout = 50000) {
        this.queue = new Map();
        this.timers = new Map();
        this.idsCallbacks = new Map();
        this.workingOnPromise = new Map();
        this.logger = logger;
        this.timeout = timeout;
        this.concurrencyLimit = concurrencyLimit < 1 ? 15 : concurrencyLimit;
    }
    /**
     * Limpiar colar de proceso
     * @param from
     * @param item
     */
    clearAndDone(from, item) {
        this.clearIdFromCallback(from, item.fingerIdRef);
        this.logger.log(`${from}: SUCCESS: ${item.fingerIdRef}`);
    }
    async processItem(from, item) {
        try {
            const refToPromise = item.promiseFunc(item);
            const value = await Promise.race([
                refToPromise.timerPromise,
                refToPromise.promiseInFunc().then(() => {
                    refToPromise.cancel();
                    return 'success'; // Assuming 'success' is a valid T
                }),
            ]);
            item.resolve(value);
        }
        catch (err) {
            this.clearIdFromCallback(from, item.fingerIdRef);
            this.logger.error(`${from}:ERROR: ${JSON.stringify(err)}`);
            item.reject(err);
        }
    }
    async enqueue(from, promiseInFunc, fingerIdRef) {
        this.logger.log(`${from}: QUEUE: ${fingerIdRef}`);
        if (!this.timers.has(fingerIdRef)) {
            this.timers.set(fingerIdRef, false);
        }
        if (!this.queue.has(from)) {
            this.queue.set(from, []);
            this.workingOnPromise.set(from, false);
        }
        const queueByFrom = this.queue.get(from);
        const workingByFrom = this.workingOnPromise.get(from);
        /**
         *
         * @param item
         * @returns
         */
        const promiseFunc = (item) => {
            const timer = ({ resolve }) => setTimeout(() => {
                console.log('no debe aparecer si la otra funcion del race se ejecuta primero 🙉🙉🙉🙉', fingerIdRef);
                resolve('timeout');
            }, this.timeout);
            const timerPromise = new Promise((resolve, reject) => {
                if (item.cancelled) {
                    reject('cancelled');
                }
                if (!this.timers.has(fingerIdRef)) {
                    const refIdTimeOut = timer({ reject, resolve });
                    clearTimeout(this.timers.get(fingerIdRef));
                    this.timers.set(fingerIdRef, refIdTimeOut);
                    this.clearAndDone(from, item);
                    this.clearQueue(from);
                    return refIdTimeOut;
                }
                return this.timers.get(fingerIdRef);
            });
            const cancel = () => {
                clearTimeout(this.timers.get(fingerIdRef));
                this.timers.delete(fingerIdRef);
                this.clearAndDone(from, item);
            };
            return { promiseInFunc, timer, timerPromise, cancel };
        };
        return new Promise((resolve, reject) => {
            const pid = queueByFrom.findIndex((i) => i.fingerIdRef === fingerIdRef);
            if (pid !== -1) {
                this.clearQueue(from);
            }
            queueByFrom.push({
                promiseFunc,
                fingerIdRef,
                cancelled: false,
                resolve,
                reject,
            });
            if (!workingByFrom) {
                this.logger.log(`${from}: EXECUTING: ${fingerIdRef}`);
                this.processQueue(from);
                this.workingOnPromise.set(from, true);
            }
        });
    }
    async processQueue(from) {
        const queueByFrom = this.queue.get(from);
        while (queueByFrom.length > 0) {
            const tasksToProcess = queueByFrom.splice(0, this.concurrencyLimit - 1);
            const promises = tasksToProcess.map((item) => this.processItem(from, item).finally(() => this.clearAndDone(from, item)));
            await Promise.all(promises);
        }
        this.workingOnPromise.set(from, false);
        await this.clearQueue(from);
    }
    async clearQueue(from) {
        if (this.queue.has(from)) {
            const queueByFrom = this.queue.get(from);
            const workingByFrom = this.workingOnPromise.get(from);
            try {
                for (const item of queueByFrom) {
                    item.cancelled = true;
                    this.clearAndDone(from, item);
                    item.resolve('Queue cleared');
                }
            }
            finally {
                this.queue.set(from, []);
                this.idsCallbacks.set(from, []);
            }
            if (workingByFrom) {
                this.workingOnPromise.set(from, false);
            }
            const queueNumber = queueByFrom.length;
            return Promise.resolve(queueNumber);
        }
    }
    setIdsCallbacks(from, ids = []) {
        this.idsCallbacks.set(from, ids);
    }
    getIdsCallback(from) {
        return this.idsCallbacks.get(from) || [];
    }
    getIdWithFrom(from, id) {
        const ids = this.idsCallbacks.get(from) || [];
        const index = ids.indexOf(id);
        return index;
    }
    clearIdFromCallback(from, id) {
        if (this.idsCallbacks.has(from)) {
            const ids = this.idsCallbacks.get(from);
            const index = ids.indexOf(id);
            if (index !== -1) {
                ids.splice(index, 1);
            }
        }
    }
}

var followRedirects = {exports: {}};

var src$1 = {exports: {}};

var browser$1 = {exports: {}};

var ms$1;
var hasRequiredMs$1;

function requireMs$1 () {
	if (hasRequiredMs$1) return ms$1;
	hasRequiredMs$1 = 1;
	var s = 1000;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var w = d * 7;
	var y = d * 365.25;

	ms$1 = function(val, options) {
	  options = options || {};
	  var type = typeof val;
	  if (type === 'string' && val.length > 0) {
	    return parse(val);
	  } else if (type === 'number' && isFinite(val)) {
	    return options.long ? fmtLong(val) : fmtShort(val);
	  }
	  throw new Error(
	    'val is not a non-empty string or a valid number. val=' +
	      JSON.stringify(val)
	  );
	};


	function parse(str) {
	  str = String(str);
	  if (str.length > 100) {
	    return;
	  }
	  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
	    str
	  );
	  if (!match) {
	    return;
	  }
	  var n = parseFloat(match[1]);
	  var type = (match[2] || 'ms').toLowerCase();
	  switch (type) {
	    case 'years':
	    case 'year':
	    case 'yrs':
	    case 'yr':
	    case 'y':
	      return n * y;
	    case 'weeks':
	    case 'week':
	    case 'w':
	      return n * w;
	    case 'days':
	    case 'day':
	    case 'd':
	      return n * d;
	    case 'hours':
	    case 'hour':
	    case 'hrs':
	    case 'hr':
	    case 'h':
	      return n * h;
	    case 'minutes':
	    case 'minute':
	    case 'mins':
	    case 'min':
	    case 'm':
	      return n * m;
	    case 'seconds':
	    case 'second':
	    case 'secs':
	    case 'sec':
	    case 's':
	      return n * s;
	    case 'milliseconds':
	    case 'millisecond':
	    case 'msecs':
	    case 'msec':
	    case 'ms':
	      return n;
	    default:
	      return undefined;
	  }
	}

	function fmtShort(ms) {
	  var msAbs = Math.abs(ms);
	  if (msAbs >= d) {
	    return Math.round(ms / d) + 'd';
	  }
	  if (msAbs >= h) {
	    return Math.round(ms / h) + 'h';
	  }
	  if (msAbs >= m) {
	    return Math.round(ms / m) + 'm';
	  }
	  if (msAbs >= s) {
	    return Math.round(ms / s) + 's';
	  }
	  return ms + 'ms';
	}


	function fmtLong(ms) {
	  var msAbs = Math.abs(ms);
	  if (msAbs >= d) {
	    return plural(ms, msAbs, d, 'day');
	  }
	  if (msAbs >= h) {
	    return plural(ms, msAbs, h, 'hour');
	  }
	  if (msAbs >= m) {
	    return plural(ms, msAbs, m, 'minute');
	  }
	  if (msAbs >= s) {
	    return plural(ms, msAbs, s, 'second');
	  }
	  return ms + ' ms';
	}

	function plural(ms, msAbs, n, name) {
	  var isPlural = msAbs >= n * 1.5;
	  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
	}
	return ms$1;
}

var common;
var hasRequiredCommon;

function requireCommon () {
	if (hasRequiredCommon) return common;
	hasRequiredCommon = 1;

	function setup(env) {
		createDebug.debug = createDebug;
		createDebug.default = createDebug;
		createDebug.coerce = coerce;
		createDebug.disable = disable;
		createDebug.enable = enable;
		createDebug.enabled = enabled;
		createDebug.humanize = requireMs$1();
		createDebug.destroy = destroy;

		Object.keys(env).forEach(key => {
			createDebug[key] = env[key];
		});

		/**
		* The currently active debug mode names, and names to skip.
		*/

		createDebug.names = [];
		createDebug.skips = [];

		/**
		* Map of special "%n" handling functions, for the debug "format" argument.
		*
		* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
		*/
		createDebug.formatters = {};

		/**
		* Selects a color for a debug namespace
		* @param {String} namespace The namespace string for the debug instance to be colored
		* @return {Number|String} An ANSI color code for the given namespace
		* @api private
		*/
		function selectColor(namespace) {
			let hash = 0;

			for (let i = 0; i < namespace.length; i++) {
				hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
				hash |= 0; // Convert to 32bit integer
			}

			return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
		}
		createDebug.selectColor = selectColor;

		/**
		* Create a debugger with the given `namespace`.
		*
		* @param {String} namespace
		* @return {Function}
		* @api public
		*/
		function createDebug(namespace) {
			let prevTime;
			let enableOverride = null;
			let namespacesCache;
			let enabledCache;

			function debug(...args) {
				// Disabled?
				if (!debug.enabled) {
					return;
				}

				const self = debug;

				// Set `diff` timestamp
				const curr = Number(new Date());
				const ms = curr - (prevTime || curr);
				self.diff = ms;
				self.prev = prevTime;
				self.curr = curr;
				prevTime = curr;

				args[0] = createDebug.coerce(args[0]);

				if (typeof args[0] !== 'string') {
					// Anything else let's inspect with %O
					args.unshift('%O');
				}

				// Apply any `formatters` transformations
				let index = 0;
				args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
					// If we encounter an escaped % then don't increase the array index
					if (match === '%%') {
						return '%';
					}
					index++;
					const formatter = createDebug.formatters[format];
					if (typeof formatter === 'function') {
						const val = args[index];
						match = formatter.call(self, val);

						// Now we need to remove `args[index]` since it's inlined in the `format`
						args.splice(index, 1);
						index--;
					}
					return match;
				});

				// Apply env-specific formatting (colors, etc.)
				createDebug.formatArgs.call(self, args);

				const logFn = self.log || createDebug.log;
				logFn.apply(self, args);
			}

			debug.namespace = namespace;
			debug.useColors = createDebug.useColors();
			debug.color = createDebug.selectColor(namespace);
			debug.extend = extend;
			debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.

			Object.defineProperty(debug, 'enabled', {
				enumerable: true,
				configurable: false,
				get: () => {
					if (enableOverride !== null) {
						return enableOverride;
					}
					if (namespacesCache !== createDebug.namespaces) {
						namespacesCache = createDebug.namespaces;
						enabledCache = createDebug.enabled(namespace);
					}

					return enabledCache;
				},
				set: v => {
					enableOverride = v;
				}
			});

			// Env-specific initialization logic for debug instances
			if (typeof createDebug.init === 'function') {
				createDebug.init(debug);
			}

			return debug;
		}

		function extend(namespace, delimiter) {
			const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
			newDebug.log = this.log;
			return newDebug;
		}

		/**
		* Enables a debug mode by namespaces. This can include modes
		* separated by a colon and wildcards.
		*
		* @param {String} namespaces
		* @api public
		*/
		function enable(namespaces) {
			createDebug.save(namespaces);
			createDebug.namespaces = namespaces;

			createDebug.names = [];
			createDebug.skips = [];

			let i;
			const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
			const len = split.length;

			for (i = 0; i < len; i++) {
				if (!split[i]) {
					// ignore empty strings
					continue;
				}

				namespaces = split[i].replace(/\*/g, '.*?');

				if (namespaces[0] === '-') {
					createDebug.skips.push(new RegExp('^' + namespaces.slice(1) + '$'));
				} else {
					createDebug.names.push(new RegExp('^' + namespaces + '$'));
				}
			}
		}

		/**
		* Disable debug output.
		*
		* @return {String} namespaces
		* @api public
		*/
		function disable() {
			const namespaces = [
				...createDebug.names.map(toNamespace),
				...createDebug.skips.map(toNamespace).map(namespace => '-' + namespace)
			].join(',');
			createDebug.enable('');
			return namespaces;
		}

		/**
		* Returns true if the given mode name is enabled, false otherwise.
		*
		* @param {String} name
		* @return {Boolean}
		* @api public
		*/
		function enabled(name) {
			if (name[name.length - 1] === '*') {
				return true;
			}

			let i;
			let len;

			for (i = 0, len = createDebug.skips.length; i < len; i++) {
				if (createDebug.skips[i].test(name)) {
					return false;
				}
			}

			for (i = 0, len = createDebug.names.length; i < len; i++) {
				if (createDebug.names[i].test(name)) {
					return true;
				}
			}

			return false;
		}

		/**
		* Convert regexp to namespace
		*
		* @param {RegExp} regxep
		* @return {String} namespace
		* @api private
		*/
		function toNamespace(regexp) {
			return regexp.toString()
				.substring(2, regexp.toString().length - 2)
				.replace(/\.\*\?$/, '*');
		}

		/**
		* Coerce `val`.
		*
		* @param {Mixed} val
		* @return {Mixed}
		* @api private
		*/
		function coerce(val) {
			if (val instanceof Error) {
				return val.stack || val.message;
			}
			return val;
		}

		/**
		* XXX DO NOT USE. This is a temporary stub function.
		* XXX It WILL be removed in the next major release.
		*/
		function destroy() {
			console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
		}

		createDebug.enable(createDebug.load());

		return createDebug;
	}

	common = setup;
	return common;
}

/* eslint-env browser */

var hasRequiredBrowser$1;

function requireBrowser$1 () {
	if (hasRequiredBrowser$1) return browser$1.exports;
	hasRequiredBrowser$1 = 1;
	(function (module, exports) {
		/**
		 * This is the web browser implementation of `debug()`.
		 */

		exports.formatArgs = formatArgs;
		exports.save = save;
		exports.load = load;
		exports.useColors = useColors;
		exports.storage = localstorage();
		exports.destroy = (() => {
			let warned = false;

			return () => {
				if (!warned) {
					warned = true;
					console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
				}
			};
		})();

		/**
		 * Colors.
		 */

		exports.colors = [
			'#0000CC',
			'#0000FF',
			'#0033CC',
			'#0033FF',
			'#0066CC'
		];

		/**
		 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
		 * and the Firebug extension (any Firefox version) are known
		 * to support "%c" CSS customizations.
		 *
		 * TODO: add a `localStorage` variable to explicitly enable/disable colors
		 */

		// eslint-disable-next-line complexity
		function useColors() {
			// NB: In an Electron preload script, document will be defined but not fully
			// initialized. Since we know we're in Chrome, we'll just detect this case
			// explicitly
			if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
				return true;
			}

			// Internet Explorer and Edge do not support colors.
			if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
				return false;
			}

			// Is webkit? http://stackoverflow.com/a/16459606/376773
			// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
			return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
				// Is firebug? http://stackoverflow.com/a/398120/376773
				(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
				// Is firefox >= v31?
				// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
				(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
				// Double check webkit in userAgent just in case we are in a worker
				(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
		}

		/**
		 * Colorize log arguments if enabled.
		 *
		 * @api public
		 */

		function formatArgs(args) {
			args[0] = (this.useColors ? '%c' : '') +
				this.namespace +
				(this.useColors ? ' %c' : ' ') +
				args[0] +
				(this.useColors ? '%c ' : ' ') +
				'+' + module.exports.humanize(this.diff);

			if (!this.useColors) {
				return;
			}

			const c = 'color: ' + this.color;
			args.splice(1, 0, c, 'color: inherit');

			// The final "%c" is somewhat tricky, because there could be other
			// arguments passed either before or after the %c, so we need to
			// figure out the correct index to insert the CSS into
			let index = 0;
			let lastC = 0;
			args[0].replace(/%[a-zA-Z%]/g, match => {
				if (match === '%%') {
					return;
				}
				index++;
				if (match === '%c') {
					// We only are interested in the *last* %c
					// (the user may have provided their own)
					lastC = index;
				}
			});

			args.splice(lastC, 0, c);
		}

		/**
		 * Invokes `console.debug()` when available.
		 * No-op when `console.debug` is not a "function".
		 * If `console.debug` is not available, falls back
		 * to `console.log`.
		 *
		 * @api public
		 */
		exports.log = console.debug || console.log || (() => {});

		/**
		 * Save `namespaces`.
		 *
		 * @param {String} namespaces
		 * @api private
		 */
		function save(namespaces) {
			try {
				if (namespaces) {
					exports.storage.setItem('debug', namespaces);
				} else {
					exports.storage.removeItem('debug');
				}
			} catch (error) {
				// Swallow
				// XXX (@Qix-) should we be logging these?
			}
		}

		/**
		 * Load `namespaces`.
		 *
		 * @return {String} returns the previously persisted debug modes
		 * @api private
		 */
		function load() {
			let r;
			try {
				r = exports.storage.getItem('debug');
			} catch (error) {
				// Swallow
				// XXX (@Qix-) should we be logging these?
			}

			// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
			if (!r && typeof process !== 'undefined' && 'env' in process) {
				r = process.env.DEBUG;
			}

			return r;
		}

		/**
		 * Localstorage attempts to return the localstorage.
		 *
		 * This is necessary because safari throws
		 * when a user disables cookies/localstorage
		 * and you attempt to access it.
		 *
		 * @return {LocalStorage}
		 * @api private
		 */

		function localstorage() {
			try {
				// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
				// The Browser also has localStorage in the global context.
				return localStorage;
			} catch (error) {
				// Swallow
				// XXX (@Qix-) should we be logging these?
			}
		}

		module.exports = requireCommon()(exports);

		const {formatters} = module.exports;

		/**
		 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
		 */

		formatters.j = function (v) {
			try {
				return JSON.stringify(v);
			} catch (error) {
				return '[UnexpectedJSONParseError]: ' + error.message;
			}
		}; 
	} (browser$1, browser$1.exports));
	return browser$1.exports;
}

var node$1 = {exports: {}};

var hasFlag;
var hasRequiredHasFlag;

function requireHasFlag () {
	if (hasRequiredHasFlag) return hasFlag;
	hasRequiredHasFlag = 1;

	hasFlag = (flag, argv = process.argv) => {
		const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
		const position = argv.indexOf(prefix + flag);
		const terminatorPosition = argv.indexOf('--');
		return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
	};
	return hasFlag;
}

var supportsColor_1;
var hasRequiredSupportsColor;

function requireSupportsColor () {
	if (hasRequiredSupportsColor) return supportsColor_1;
	hasRequiredSupportsColor = 1;
	const os = require$$0$5;
	const tty = require$$0$4;
	const hasFlag = requireHasFlag();

	const {env} = process;

	let forceColor;
	if (hasFlag('no-color') ||
		hasFlag('no-colors') ||
		hasFlag('color=false') ||
		hasFlag('color=never')) {
		forceColor = 0;
	} else if (hasFlag('color') ||
		hasFlag('colors') ||
		hasFlag('color=true') ||
		hasFlag('color=always')) {
		forceColor = 1;
	}

	if ('FORCE_COLOR' in env) {
		if (env.FORCE_COLOR === 'true') {
			forceColor = 1;
		} else if (env.FORCE_COLOR === 'false') {
			forceColor = 0;
		} else {
			forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
		}
	}

	function translateLevel(level) {
		if (level === 0) {
			return false;
		}

		return {
			level,
			hasBasic: true,
			has256: level >= 2,
			has16m: level >= 3
		};
	}

	function supportsColor(haveStream, streamIsTTY) {
		if (forceColor === 0) {
			return 0;
		}

		if (hasFlag('color=16m') ||
			hasFlag('color=full') ||
			hasFlag('color=truecolor')) {
			return 3;
		}

		if (hasFlag('color=256')) {
			return 2;
		}

		if (haveStream && !streamIsTTY && forceColor === undefined) {
			return 0;
		}

		const min = forceColor || 0;

		if (env.TERM === 'dumb') {
			return min;
		}

		if (process.platform === 'win32') {
			// Windows 10 build 10586 is the first Windows release that supports 256 colors.
			// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
			const osRelease = os.release().split('.');
			if (
				Number(osRelease[0]) >= 10 &&
				Number(osRelease[2]) >= 10586
			) {
				return Number(osRelease[2]) >= 14931 ? 3 : 2;
			}

			return 1;
		}

		if ('CI' in env) {
			if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'GITHUB_ACTIONS', 'BUILDKITE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
				return 1;
			}

			return min;
		}

		if ('TEAMCITY_VERSION' in env) {
			return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
		}

		if (env.COLORTERM === 'truecolor') {
			return 3;
		}

		if ('TERM_PROGRAM' in env) {
			const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

			switch (env.TERM_PROGRAM) {
				case 'iTerm.app':
					return version >= 3 ? 3 : 2;
				case 'Apple_Terminal':
					return 2;
				// No default
			}
		}

		if (/-256(color)?$/i.test(env.TERM)) {
			return 2;
		}

		if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
			return 1;
		}

		if ('COLORTERM' in env) {
			return 1;
		}

		return min;
	}

	function getSupportLevel(stream) {
		const level = supportsColor(stream, stream && stream.isTTY);
		return translateLevel(level);
	}

	supportsColor_1 = {
		supportsColor: getSupportLevel,
		stdout: translateLevel(supportsColor(true, tty.isatty(1))),
		stderr: translateLevel(supportsColor(true, tty.isatty(2)))
	};
	return supportsColor_1;
}

var hasRequiredNode$1;

function requireNode$1 () {
	if (hasRequiredNode$1) return node$1.exports;
	hasRequiredNode$1 = 1;
	(function (module, exports) {
		const tty = require$$0$4;
		const util = require$$1$1;

		/**
		 * This is the Node.js implementation of `debug()`.
		 */

		exports.init = init;
		exports.log = log;
		exports.formatArgs = formatArgs;
		exports.save = save;
		exports.load = load;
		exports.useColors = useColors;
		exports.destroy = util.deprecate(
			() => {},
			'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.'
		);

		/**
		 * Colors.
		 */

		exports.colors = [6, 2, 3, 4, 5, 1];

		try {
			// Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
			// eslint-disable-next-line import/no-extraneous-dependencies
			const supportsColor = requireSupportsColor();

			if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
				exports.colors = [
					20,
					21,
					26,
					27,
					32,
					33,
					38,
					39,
					40,
					41,
					42,
					43,
					44,
					45,
					56,
					57,
					62,
					63,
					68,
					69,
					74,
					75,
					76,
					77,
					78,
					79,
					80,
					81,
					92,
					93,
					98,
					99,
					112,
					113,
					128,
					129,
					134,
					135,
					148,
					149,
					160,
					161,
					162,
					163,
					164,
					165,
					166,
					167,
					168,
					169,
					170,
					171,
					172,
					173,
					178,
					179,
					184,
					185,
					196,
					197,
					198,
					199,
					200,
					201,
					202,
					203,
					204,
					205,
					206,
					207,
					208,
					209,
					214,
					215,
					220,
					221
				];
			}
		} catch (error) {
			// Swallow - we only care if `supports-color` is available; it doesn't have to be.
		}

		/**
		 * Build up the default `inspectOpts` object from the environment variables.
		 *
		 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
		 */

		exports.inspectOpts = Object.keys(process.env).filter(key => {
			return /^debug_/i.test(key);
		}).reduce((obj, key) => {
			// Camel-case
			const prop = key
				.substring(6)
				.toLowerCase()
				.replace(/_([a-z])/g, (_, k) => {
					return k.toUpperCase();
				});

			// Coerce string value into JS value
			let val = process.env[key];
			if (/^(yes|on|true|enabled)$/i.test(val)) {
				val = true;
			} else if (/^(no|off|false|disabled)$/i.test(val)) {
				val = false;
			} else if (val === 'null') {
				val = null;
			} else {
				val = Number(val);
			}

			obj[prop] = val;
			return obj;
		}, {});

		/**
		 * Is stdout a TTY? Colored output is enabled when `true`.
		 */

		function useColors() {
			return 'colors' in exports.inspectOpts ?
				Boolean(exports.inspectOpts.colors) :
				tty.isatty(process.stderr.fd);
		}

		/**
		 * Adds ANSI color escape codes if enabled.
		 *
		 * @api public
		 */

		function formatArgs(args) {
			const {namespace: name, useColors} = this;

			if (useColors) {
				const c = this.color;
				const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c);
				const prefix = `  ${colorCode};1m${name} \u001B[0m`;

				args[0] = prefix + args[0].split('\n').join('\n' + prefix);
				args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m');
			} else {
				args[0] = getDate() + name + ' ' + args[0];
			}
		}

		function getDate() {
			if (exports.inspectOpts.hideDate) {
				return '';
			}
			return new Date().toISOString() + ' ';
		}

		/**
		 * Invokes `util.format()` with the specified arguments and writes to stderr.
		 */

		function log(...args) {
			return process.stderr.write(util.format(...args) + '\n');
		}

		/**
		 * Save `namespaces`.
		 *
		 * @param {String} namespaces
		 * @api private
		 */
		function save(namespaces) {
			if (namespaces) {
				process.env.DEBUG = namespaces;
			} else {
				// If you set a process.env field to null or undefined, it gets cast to the
				// string 'null' or 'undefined'. Just delete instead.
				delete process.env.DEBUG;
			}
		}

		/**
		 * Load `namespaces`.
		 *
		 * @return {String} returns the previously persisted debug modes
		 * @api private
		 */

		function load() {
			return process.env.DEBUG;
		}

		/**
		 * Init logic for `debug` instances.
		 *
		 * Create a new `inspectOpts` object in case `useColors` is set
		 * differently for a particular `debug` instance.
		 */

		function init(debug) {
			debug.inspectOpts = {};

			const keys = Object.keys(exports.inspectOpts);
			for (let i = 0; i < keys.length; i++) {
				debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
			}
		}

		module.exports = requireCommon()(exports);

		const {formatters} = module.exports;

		/**
		 * Map %o to `util.inspect()`, all on a single line.
		 */

		formatters.o = function (v) {
			this.inspectOpts.colors = this.useColors;
			return util.inspect(v, this.inspectOpts)
				.split('\n')
				.map(str => str.trim())
				.join(' ');
		};

		/**
		 * Map %O to `util.inspect()`, allowing multiple lines if needed.
		 */

		formatters.O = function (v) {
			this.inspectOpts.colors = this.useColors;
			return util.inspect(v, this.inspectOpts);
		}; 
	} (node$1, node$1.exports));
	return node$1.exports;
}


var hasRequiredSrc$1;

function requireSrc$1 () {
	if (hasRequiredSrc$1) return src$1.exports;
	hasRequiredSrc$1 = 1;
	if (typeof process === 'undefined' || process.type === 'renderer' || process.browser === true || process.__nwjs) {
		src$1.exports = requireBrowser$1();
	} else {
		src$1.exports = requireNode$1();
	}
	return src$1.exports;
}

var debug$2;

var debug_1 = function () {
  if (!debug$2) {
    try {
      /* eslint global-require: off */
      debug$2 = requireSrc$1()("follow-redirects");
    }
    catch (error) { /* */ }
    if (typeof debug$2 !== "function") {
      debug$2 = function () { /* */ };
    }
  }
  debug$2.apply(null, arguments);
};

var url$1 = require$$0$6;
var URL$1 = url$1.URL;
var http$1 = require$$1$3;
var https = require$$2$1;
var Writable = require$$1$2.Writable;
var assert = require$$4$1;
var debug$1 = debug_1;

// Whether to use the native URL object or the legacy url module
var useNativeURL = false;
try {
  assert(new URL$1());
}
catch (error) {
  useNativeURL = error.code === "ERR_INVALID_URL";
}

// URL fields to preserve in copy operations
var preservedUrlFields = [
  "auth",
  "host",
  "hostname",
  "href",
  "path",
  "pathname",
  "port",
  "protocol",
  "query",
  "search",
  "hash",
];

// Create handlers that pass events from native requests
var events = ["abort", "aborted", "connect", "error", "socket", "timeout"];
var eventHandlers = Object.create(null);
events.forEach(function (event) {
  eventHandlers[event] = function (arg1, arg2, arg3) {
    this._redirectable.emit(event, arg1, arg2, arg3);
  };
});

// Error types with codes
var InvalidUrlError = createErrorType(
  "ERR_INVALID_URL",
  "Invalid URL",
  TypeError
);
var RedirectionError = createErrorType(
  "ERR_FR_REDIRECTION_FAILURE",
  "Redirected request failed"
);
var TooManyRedirectsError = createErrorType(
  "ERR_FR_TOO_MANY_REDIRECTS",
  "Maximum number of redirects exceeded",
  RedirectionError
);
var MaxBodyLengthExceededError = createErrorType(
  "ERR_FR_MAX_BODY_LENGTH_EXCEEDED",
  "Request body larger than maxBodyLength limit"
);
var WriteAfterEndError = createErrorType(
  "ERR_STREAM_WRITE_AFTER_END",
  "write after end"
);

// istanbul ignore next
var destroy = Writable.prototype.destroy || noop;

// An HTTP(S) request that can be redirected
function RedirectableRequest(options, responseCallback) {
  // Initialize the request
  Writable.call(this);
  this._sanitizeOptions(options);
  this._options = options;
  this._ended = false;
  this._ending = false;
  this._redirectCount = 0;
  this._redirects = [];
  this._requestBodyLength = 0;
  this._requestBodyBuffers = [];

  // Attach a callback if passed
  if (responseCallback) {
    this.on("response", responseCallback);
  }

  // React to responses of native requests
  var self = this;
  this._onNativeResponse = function (response) {
    try {
      self._processResponse(response);
    }
    catch (cause) {
      self.emit("error", cause instanceof RedirectionError ?
        cause : new RedirectionError({ cause: cause }));
    }
  };

  // Perform the first request
  this._performRequest();
}
RedirectableRequest.prototype = Object.create(Writable.prototype);

RedirectableRequest.prototype.abort = function () {
  destroyRequest(this._currentRequest);
  this._currentRequest.abort();
  this.emit("abort");
};

RedirectableRequest.prototype.destroy = function (error) {
  destroyRequest(this._currentRequest, error);
  destroy.call(this, error);
  return this;
};

// Writes buffered data to the current native request
RedirectableRequest.prototype.write = function (data, encoding, callback) {
  // Writing is not allowed if end has been called
  if (this._ending) {
    throw new WriteAfterEndError();
  }

  // Validate input and shift parameters if necessary
  if (!isString(data) && !isBuffer(data)) {
    throw new TypeError("data should be a string, Buffer or Uint8Array");
  }
  if (isFunction(encoding)) {
    callback = encoding;
    encoding = null;
  }

  // Ignore empty buffers, since writing them doesn't invoke the callback
  // https://github.com/nodejs/node/issues/22066
  if (data.length === 0) {
    if (callback) {
      callback();
    }
    return;
  }
  // Only write when we don't exceed the maximum body length
  if (this._requestBodyLength + data.length <= this._options.maxBodyLength) {
    this._requestBodyLength += data.length;
    this._requestBodyBuffers.push({ data: data, encoding: encoding });
    this._currentRequest.write(data, encoding, callback);
  }
  // Error when we exceed the maximum body length
  else {
    this.emit("error", new MaxBodyLengthExceededError());
    this.abort();
  }
};

// Ends the current native request
RedirectableRequest.prototype.end = function (data, encoding, callback) {
  // Shift parameters if necessary
  if (isFunction(data)) {
    callback = data;
    data = encoding = null;
  }
  else if (isFunction(encoding)) {
    callback = encoding;
    encoding = null;
  }

  // Write data if needed and end
  if (!data) {
    this._ended = this._ending = true;
    this._currentRequest.end(null, null, callback);
  }
  else {
    var self = this;
    var currentRequest = this._currentRequest;
    this.write(data, encoding, function () {
      self._ended = true;
      currentRequest.end(null, null, callback);
    });
    this._ending = true;
  }
};

// Sets a header value on the current native request
RedirectableRequest.prototype.setHeader = function (name, value) {
  this._options.headers[name] = value;
  this._currentRequest.setHeader(name, value);
};

// Clears a header value on the current native request
RedirectableRequest.prototype.removeHeader = function (name) {
  delete this._options.headers[name];
  this._currentRequest.removeHeader(name);
};

// Global timeout for all underlying requests
RedirectableRequest.prototype.setTimeout = function (msecs, callback) {
  var self = this;

  // Destroys the socket on timeout
  function destroyOnTimeout(socket) {
    socket.setTimeout(msecs);
    socket.removeListener("timeout", socket.destroy);
    socket.addListener("timeout", socket.destroy);
  }

  // Sets up a timer to trigger a timeout event
  function startTimer(socket) {
    if (self._timeout) {
      clearTimeout(self._timeout);
    }
    self._timeout = setTimeout(function () {
      self.emit("timeout");
      clearTimer();
    }, msecs);
    destroyOnTimeout(socket);
  }

  // Stops a timeout from triggering
  function clearTimer() {
    // Clear the timeout
    if (self._timeout) {
      clearTimeout(self._timeout);
      self._timeout = null;
    }

    // Clean up all attached listeners
    self.removeListener("abort", clearTimer);
    self.removeListener("error", clearTimer);
    self.removeListener("response", clearTimer);
    self.removeListener("close", clearTimer);
    if (callback) {
      self.removeListener("timeout", callback);
    }
    if (!self.socket) {
      self._currentRequest.removeListener("socket", startTimer);
    }
  }

  // Attach callback if passed
  if (callback) {
    this.on("timeout", callback);
  }

  // Start the timer if or when the socket is opened
  if (this.socket) {
    startTimer(this.socket);
  }
  else {
    this._currentRequest.once("socket", startTimer);
  }

  // Clean up on events
  this.on("socket", destroyOnTimeout);
  this.on("abort", clearTimer);
  this.on("error", clearTimer);
  this.on("response", clearTimer);
  this.on("close", clearTimer);

  return this;
};

// Proxy all other public ClientRequest methods
[
  "flushHeaders", "getHeader",
  "setNoDelay", "setSocketKeepAlive",
].forEach(function (method) {
  RedirectableRequest.prototype[method] = function (a, b) {
    return this._currentRequest[method](a, b);
  };
});

// Proxy all public ClientRequest properties
["aborted", "connection", "socket"].forEach(function (property) {
  Object.defineProperty(RedirectableRequest.prototype, property, {
    get: function () { return this._currentRequest[property]; },
  });
});

RedirectableRequest.prototype._sanitizeOptions = function (options) {
  // Ensure headers are always present
  if (!options.headers) {
    options.headers = {};
  }

  // Since http.request treats host as an alias of hostname,
  // but the url module interprets host as hostname plus port,
  // eliminate the host property to avoid confusion.
  if (options.host) {
    // Use hostname if set, because it has precedence
    if (!options.hostname) {
      options.hostname = options.host;
    }
    delete options.host;
  }

  // Complete the URL object when necessary
  if (!options.pathname && options.path) {
    var searchPos = options.path.indexOf("?");
    if (searchPos < 0) {
      options.pathname = options.path;
    }
    else {
      options.pathname = options.path.substring(0, searchPos);
      options.search = options.path.substring(searchPos);
    }
  }
};


// Executes the next native request (initial or redirect)
RedirectableRequest.prototype._performRequest = function () {
  // Load the native protocol
  var protocol = this._options.protocol;
  var nativeProtocol = this._options.nativeProtocols[protocol];
  if (!nativeProtocol) {
    throw new TypeError("Unsupported protocol " + protocol);
  }

  // If specified, use the agent corresponding to the protocol
  // (HTTP and HTTPS use different types of agents)
  if (this._options.agents) {
    var scheme = protocol.slice(0, -1);
    this._options.agent = this._options.agents[scheme];
  }

  // Create the native request and set up its event handlers
  var request = this._currentRequest =
        nativeProtocol.request(this._options, this._onNativeResponse);
  request._redirectable = this;
  for (var event of events) {
    request.on(event, eventHandlers[event]);
  }

  // RFC7230§5.3.1: When making a request directly to an origin server, […]
  // a client MUST send only the absolute path […] as the request-target.
  this._currentUrl = /^\//.test(this._options.path) ?
    url$1.format(this._options) :
    // When making a request to a proxy, […]
    // a client MUST send the target URI in absolute-form […].
    this._options.path;

  // End a redirected request
  // (The first request must be ended explicitly with RedirectableRequest#end)
  if (this._isRedirect) {
    // Write the request entity and end
    var i = 0;
    var self = this;
    var buffers = this._requestBodyBuffers;
    (function writeNext(error) {
      // Only write if this request has not been redirected yet
      /* istanbul ignore else */
      if (request === self._currentRequest) {
        // Report any write errors
        /* istanbul ignore if */
        if (error) {
          self.emit("error", error);
        }
        // Write the next buffer if there are still left
        else if (i < buffers.length) {
          var buffer = buffers[i++];
          /* istanbul ignore else */
          if (!request.finished) {
            request.write(buffer.data, buffer.encoding, writeNext);
          }
        }
        // End the request if `end` has been called on us
        else if (self._ended) {
          request.end();
        }
      }
    }());
  }
};

// Processes a response from the current native request
RedirectableRequest.prototype._processResponse = function (response) {
  // Store the redirected response
  var statusCode = response.statusCode;
  if (this._options.trackRedirects) {
    this._redirects.push({
      url: this._currentUrl,
      headers: response.headers,
      statusCode: statusCode,
    });
  }

  // RFC7231§6.4: The 3xx (Redirection) class of status code indicates
  // that further action needs to be taken by the user agent in order to
  // fulfill the request. If a Location header field is provided,
  // the user agent MAY automatically redirect its request to the URI
  // referenced by the Location field value,
  // even if the specific status code is not understood.

  // If the response is not a redirect; return it as-is
  var location = response.headers.location;
  if (!location || this._options.followRedirects === false ||
      statusCode < 300 || statusCode >= 400) {
    response.responseUrl = this._currentUrl;
    response.redirects = this._redirects;
    this.emit("response", response);

    // Clean up
    this._requestBodyBuffers = [];
    return;
  }

  // The response is a redirect, so abort the current request
  destroyRequest(this._currentRequest);
  // Discard the remainder of the response to avoid waiting for data
  response.destroy();

  // RFC7231§6.4: A client SHOULD detect and intervene
  // in cyclical redirections (i.e., "infinite" redirection loops).
  if (++this._redirectCount > this._options.maxRedirects) {
    throw new TooManyRedirectsError();
  }

  // Store the request headers if applicable
  var requestHeaders;
  var beforeRedirect = this._options.beforeRedirect;
  if (beforeRedirect) {
    requestHeaders = Object.assign({
      // The Host header was set by nativeProtocol.request
      Host: response.req.getHeader("host"),
    }, this._options.headers);
  }

  // RFC7231§6.4: Automatic redirection needs to done with
  // care for methods not known to be safe, […]
  // RFC7231§6.4.2–3: For historical reasons, a user agent MAY change
  // the request method from POST to GET for the subsequent request.
  var method = this._options.method;
  if ((statusCode === 301 || statusCode === 302) && this._options.method === "POST" ||
      // RFC7231§6.4.4: The 303 (See Other) status code indicates that
      // the server is redirecting the user agent to a different resource […]
      // A user agent can perform a retrieval request targeting that URI
      // (a GET or HEAD request if using HTTP) […]
      (statusCode === 303) && !/^(?:GET|HEAD)$/.test(this._options.method)) {
    this._options.method = "GET";
    // Drop a possible entity and headers related to it
    this._requestBodyBuffers = [];
    removeMatchingHeaders(/^content-/i, this._options.headers);
  }

  // Drop the Host header, as the redirect might lead to a different host
  var currentHostHeader = removeMatchingHeaders(/^host$/i, this._options.headers);

  // If the redirect is relative, carry over the host of the last request
  var currentUrlParts = parseUrl(this._currentUrl);
  var currentHost = currentHostHeader || currentUrlParts.host;
  var currentUrl = /^\w+:/.test(location) ? this._currentUrl :
    url$1.format(Object.assign(currentUrlParts, { host: currentHost }));

  // Create the redirected request
  var redirectUrl = resolveUrl(location, currentUrl);
  debug$1("redirecting to", redirectUrl.href);
  this._isRedirect = true;
  spreadUrlObject(redirectUrl, this._options);

  // Drop confidential headers when redirecting to a less secure protocol
  // or to a different domain that is not a superdomain
  if (redirectUrl.protocol !== currentUrlParts.protocol &&
     redirectUrl.protocol !== "https:" ||
     redirectUrl.host !== currentHost &&
     !isSubdomain(redirectUrl.host, currentHost)) {
    removeMatchingHeaders(/^(?:(?:proxy-)?authorization|cookie)$/i, this._options.headers);
  }

  // Evaluate the beforeRedirect callback
  if (isFunction(beforeRedirect)) {
    var responseDetails = {
      headers: response.headers,
      statusCode: statusCode,
    };
    var requestDetails = {
      url: currentUrl,
      method: method,
      headers: requestHeaders,
    };
    beforeRedirect(this._options, responseDetails, requestDetails);
    this._sanitizeOptions(this._options);
  }

  // Perform the redirected request
  this._performRequest();
};

// Wraps the key/value object of protocols with redirect functionality
function wrap(protocols) {
  // Default settings
  var exports = {
    maxRedirects: 21,
    maxBodyLength: 10 * 1024 * 1024,
  };

  // Wrap each protocol
  var nativeProtocols = {};
  Object.keys(protocols).forEach(function (scheme) {
    var protocol = scheme + ":";
    var nativeProtocol = nativeProtocols[protocol] = protocols[scheme];
    var wrappedProtocol = exports[scheme] = Object.create(nativeProtocol);

    // Executes a request, following redirects
    function request(input, options, callback) {
      // Parse parameters, ensuring that input is an object
      if (isURL(input)) {
        input = spreadUrlObject(input);
      }
      else if (isString(input)) {
        input = spreadUrlObject(parseUrl(input));
      }
      else {
        callback = options;
        options = validateUrl(input);
        input = { protocol: protocol };
      }
      if (isFunction(options)) {
        callback = options;
        options = null;
      }

      // Set defaults
      options = Object.assign({
        maxRedirects: exports.maxRedirects,
        maxBodyLength: exports.maxBodyLength,
      }, input, options);
      options.nativeProtocols = nativeProtocols;
      if (!isString(options.host) && !isString(options.hostname)) {
        options.hostname = "::1";
      }

      assert.equal(options.protocol, protocol, "protocol mismatch");
      debug$1("options", options);
      return new RedirectableRequest(options, callback);
    }

    // Executes a GET request, following redirects
    function get(input, options, callback) {
      var wrappedRequest = wrappedProtocol.request(input, options, callback);
      wrappedRequest.end();
      return wrappedRequest;
    }

    // Expose the properties on the wrapped protocol
    Object.defineProperties(wrappedProtocol, {
      request: { value: request, configurable: true, enumerable: true, writable: true },
      get: { value: get, configurable: true, enumerable: true, writable: true },
    });
  });
  return exports;
}

function noop() { /* empty */ }

function parseUrl(input) {
  var parsed;
  /* istanbul ignore else */
  if (useNativeURL) {
    parsed = new URL$1(input);
  }
  else {
    // Ensure the URL is valid and absolute
    parsed = validateUrl(url$1.parse(input));
    if (!isString(parsed.protocol)) {
      throw new InvalidUrlError({ input });
    }
  }
  return parsed;
}

function resolveUrl(relative, base) {
  /* istanbul ignore next */
  return useNativeURL ? new URL$1(relative, base) : parseUrl(url$1.resolve(base, relative));
}

function validateUrl(input) {
  if (/^\[/.test(input.hostname) && !/^\[[:0-9a-f]+\]$/i.test(input.hostname)) {
    throw new InvalidUrlError({ input: input.href || input });
  }
  if (/^\[/.test(input.host) && !/^\[[:0-9a-f]+\](:\d+)?$/i.test(input.host)) {
    throw new InvalidUrlError({ input: input.href || input });
  }
  return input;
}

function spreadUrlObject(urlObject, target) {
  var spread = target || {};
  for (var key of preservedUrlFields) {
    spread[key] = urlObject[key];
  }

  // Fix IPv6 hostname
  if (spread.hostname.startsWith("[")) {
    spread.hostname = spread.hostname.slice(1, -1);
  }
  // Ensure port is a number
  if (spread.port !== "") {
    spread.port = Number(spread.port);
  }
  // Concatenate path
  spread.path = spread.search ? spread.pathname + spread.search : spread.pathname;

  return spread;
}

function removeMatchingHeaders(regex, headers) {
  var lastValue;
  for (var header in headers) {
    if (regex.test(header)) {
      lastValue = headers[header];
      delete headers[header];
    }
  }
  return (lastValue === null || typeof lastValue === "undefined") ?
    undefined : String(lastValue).trim();
}

function createErrorType(code, message, baseClass) {
  // Create constructor
  function CustomError(properties) {
    Error.captureStackTrace(this, this.constructor);
    Object.assign(this, properties || {});
    this.code = code;
    this.message = this.cause ? message + ": " + this.cause.message : message;
  }

  // Attach constructor and set default properties
  CustomError.prototype = new (baseClass || Error)();
  Object.defineProperties(CustomError.prototype, {
    constructor: {
      value: CustomError,
      enumerable: false,
    },
    name: {
      value: "Error [" + code + "]",
      enumerable: false,
    },
  });
  return CustomError;
}

function destroyRequest(request, error) {
  for (var event of events) {
    request.removeListener(event, eventHandlers[event]);
  }
  request.on("error", noop);
  request.destroy(error);
}

function isSubdomain(subdomain, domain) {
  assert(isString(subdomain) && isString(domain));
  var dot = subdomain.length - domain.length - 1;
  return dot > 0 && subdomain[dot] === "." && subdomain.endsWith(domain);
}

function isString(value) {
  return typeof value === "string" || value instanceof String;
}

function isFunction(value) {
  return typeof value === "function";
}

function isBuffer(value) {
  return typeof value === "object" && ("length" in value);
}

function isURL(value) {
  return URL$1 && value instanceof URL$1;
}

// Exports
followRedirects.exports = wrap({ http: http$1, https: https });
followRedirects.exports.wrap = wrap;

var followRedirectsExports = followRedirects.exports;

var mimeTypes$1 = {};

var require$$0$3 = {
	"application/1d-interleaved-parityfec": {
	source: "iana"
},
	"application/3gpdash-qoe-report+xml": {
	source: "iana",
	charset: "UTF-8",
	compressible: true
},
	"application/3gpp-ims+xml": {
	source: "iana",
	compressible: true
},
	"application/3gpphal+json": {
	source: "iana",
	compressible: true
}
};


var mimeDb;
var hasRequiredMimeDb;

function requireMimeDb () {
	if (hasRequiredMimeDb) return mimeDb;
	hasRequiredMimeDb = 1;
	
	mimeDb = require$$0$3;
	return mimeDb;
}

var hasRequiredMimeTypes;

function requireMimeTypes () {
	if (hasRequiredMimeTypes) return mimeTypes$1;
	hasRequiredMimeTypes = 1;
	(function (exports) {

		/**
		 * Module dependencies.
		 * @private
		 */

		var db = requireMimeDb();
		var extname = path.extname;

		/**
		 * Module variables.
		 * @private
		 */

		var EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
		var TEXT_TYPE_REGEXP = /^text\//i;

		/**
		 * Module exports.
		 * @public
		 */

		exports.charset = charset;
		exports.charsets = { lookup: charset };
		exports.contentType = contentType;
		exports.extension = extension;
		exports.extensions = Object.create(null);
		exports.lookup = lookup;
		exports.types = Object.create(null);

		// Populate the extensions/types maps
		populateMaps(exports.extensions, exports.types);

		/**
		 * Get the default charset for a MIME type.
		 *
		 * @param {string} type
		 * @return {boolean|string}
		 */

		function charset (type) {
		  if (!type || typeof type !== 'string') {
		    return false
		  }

		  // TODO: use media-typer
		  var match = EXTRACT_TYPE_REGEXP.exec(type);
		  var mime = match && db[match[1].toLowerCase()];

		  if (mime && mime.charset) {
		    return mime.charset
		  }

		  // default text/* to utf-8
		  if (match && TEXT_TYPE_REGEXP.test(match[1])) {
		    return 'UTF-8'
		  }

		  return false
		}

		/**
		 * Create a full Content-Type header given a MIME type or extension.
		 *
		 * @param {string} str
		 * @return {boolean|string}
		 */

		function contentType (str) {
		  // TODO: should this even be in this module?
		  if (!str || typeof str !== 'string') {
		    return false
		  }

		  var mime = str.indexOf('/') === -1
		    ? exports.lookup(str)
		    : str;

		  if (!mime) {
		    return false
		  }

		  // TODO: use content-type or other module
		  if (mime.indexOf('charset') === -1) {
		    var charset = exports.charset(mime);
		    if (charset) mime += '; charset=' + charset.toLowerCase();
		  }

		  return mime
		}

		/**
		 * Get the default extension for a MIME type.
		 *
		 * @param {string} type
		 * @return {boolean|string}
		 */

		function extension (type) {
		  if (!type || typeof type !== 'string') {
		    return false
		  }

		  // TODO: use media-typer
		  var match = EXTRACT_TYPE_REGEXP.exec(type);

		  // get extensions
		  var exts = match && exports.extensions[match[1].toLowerCase()];

		  if (!exts || !exts.length) {
		    return false
		  }

		  return exts[0]
		}

		/**
		 * Lookup the MIME type for a file path/extension.
		 *
		 * @param {string} path
		 * @return {boolean|string}
		 */

		function lookup (path) {
		  if (!path || typeof path !== 'string') {
		    return false
		  }

		  // get the extension ("ext" or ".ext" or full path)
		  var extension = extname('x.' + path)
		    .toLowerCase()
		    .substr(1);

		  if (!extension) {
		    return false
		  }

		  return exports.types[extension] || false
		}

		/**
		 * Populate the extensions and types maps.
		 * @private
		 */

		function populateMaps (extensions, types) {
		  // source preference (least -> most)
		  var preference = ['nginx', 'apache', undefined, 'iana'];

		  Object.keys(db).forEach(function forEachMimeType (type) {
		    var mime = db[type];
		    var exts = mime.extensions;

		    if (!exts || !exts.length) {
		      return
		    }

		    // mime -> extensions
		    extensions[type] = exts;

		    // extension -> mime
		    for (var i = 0; i < exts.length; i++) {
		      var extension = exts[i];

		      if (types[extension]) {
		        var from = preference.indexOf(db[types[extension]].source);
		        var to = preference.indexOf(mime.source);

		        if (types[extension] !== 'application/octet-stream' &&
		          (from > to || (from === to && types[extension].substr(0, 12) === 'application/'))) {
		          // skip the remapping
		          continue
		        }
		      }

		      // set the extension -> mime
		      types[extension] = type;
		    }
		  });
		} 
	} (mimeTypes$1));
	return mimeTypes$1;
}

var mimeTypesExports = requireMimeTypes();
var mimeTypes = /*@__PURE__*/getDefaultExportFromCjs(mimeTypesExports);

const fileTypeFromFile = async (response) => {
    const type = response.headers['content-type'] ?? '';
    const ext = mimeTypes.extension(type);
    return {
        type,
        ext,
    };
};

const generalDownload = async (url, pathToSave) => {
    const checkIsLocal = require$$3$1.existsSync(url);
    const handleDownload = () => {
        try {
            const checkProtocol = url.startsWith('http');
            const handleHttp = checkProtocol ? followRedirectsExports.https : followRedirectsExports.http;
            const fileName = path.basename(checkProtocol ? new URL(url).pathname : url);
            const name = path.parse(fileName).name;
            const fullPath = path.join(pathToSave ?? require$$0$5.tmpdir(), name);
            const file = require$$3$1.createWriteStream(fullPath);
            if (checkIsLocal) {
                /**
                 * From Local
                 */
                return new Promise((res) => {
                    const response = {
                        headers: {
                            'content-type': mimeTypes.contentType(path.extname(url)) || '',
                        },
                    };
                    res({ response, fullPath: url });
                });
            }
            else {
                /**
                 * From URL
                 */
                return new Promise((res, rej) => {
                    handleHttp.get(url, function (response) {
                        response.pipe(file);
                        file.on('finish', async function () {
                            file.close();
                            res({ response, fullPath });
                        });
                        file.on('error', function () {
                            file.close();
                            rej(new Error('Error downloading file'));
                        });
                    });
                });
            }
        }
        catch (err) {
            console.log(`Error`, err);
            return;
        }
    };
    const handleFile = (pathInput, ext) => {
        return new Promise((resolve, reject) => {
            if (!ext) {
                reject(new Error('No extension found for the file'));
                return;
            }
            const fullPath = checkIsLocal ? `${pathInput}` : `${pathInput}.${ext}`;
            require$$3$1.rename(pathInput, fullPath, (err) => {
                if (err)
                    reject(err);
                resolve(fullPath);
            });
        });
    };
    const httpResponse = await handleDownload();
    const { ext } = await fileTypeFromFile(httpResponse.response);
    if (!ext)
        throw new Error('Unable to determine file extension');
    const getPath = await handleFile(httpResponse.fullPath, ext);
    return getPath;
};

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const formats$1 = {
    mp3: {
        code: 'libmp3lame',
        ext: 'mp3',
    },
    opus: {
        code: 'libopus',
        ext: 'opus',
    },
    mp4: {
        code: 'aac',
        ext: 'mp4',
    },
};
const convertAudio = async (filePath, format = 'opus') => {
    if (!filePath) {
        throw new Error('filePath is required');
    }
    const opusFilePath = path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}.${formats$1[format].ext}`);
    await new Promise((resolve, reject) => {
        ffmpeg(filePath)
            .audioCodec(formats$1[format].code)
            .audioBitrate('64k')
            .format(formats$1[format].ext)
            .output(opusFilePath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
    return opusFilePath;
};

const cleanImage = async (FROM = null) => {
    if (!FROM) {
        throw new Error('A valid file path was not provided.');
    }
    const readBuffer = async () => {
        const data = await require$$3$1.promises.readFile(FROM);
        return Buffer.from(data);
    };
    const imgBuffer = await readBuffer();
    try {
        return new Promise((resolve, reject) => {
            import('sharp').then(({ default: sharp }) => {
                sharp(imgBuffer)
                    .extend({
                    top: 15,
                    bottom: 15,
                    left: 15,
                    right: 15,
                    background: { r: 255, g: 255, b: 255, alpha: 1 },
                })
                    .toFile(FROM, (err) => {
                    if (err)
                        reject(err);
                    resolve();
                });
            });
        });
    }
    catch (e) {
        console.log(`******** npm install sharp *******`);
        console.log(`Error:`, e);
        return Promise.reject(e);
    }
};

const getEventName = (fullHash) => {
    return decryptData(fullHash);
};
const setEvent = (name) => {
    return encryptData(`_event_custom_${name}_`);
};
const removePlus = (phone) => phone.replace('+', '').replace(/\s/g, '');

var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    BlackList: BlackList,
    Queue: Queue,
    cleanImage: cleanImage,
    convertAudio: convertAudio,
    decryptData: decryptData,
    delay: delay,
    encryptData: encryptData,
    generalDownload: generalDownload,
    generateRef: generateRef,
    generateRefProvider: generateRefProvider,
    generateRefSerialize: generateRefSerialize,
    generateRegex: generateRegex,
    generateTime: generateTime,
    getEventName: getEventName,
    printer: printer,
    removePlus: removePlus,
    setEvent: setEvent
});

const logger = new console$1.Console({
    stdout: require$$3$1.createWriteStream(`${process.cwd()}/core.class.log`),
});
const loggerQueue = new console$1.Console({
    stdout: require$$3$1.createWriteStream(`${process.cwd()}/queue.class.log`),
});
const idleForCallback = new IdleState();
class CoreClass extends EventEmitterClass {
    constructor(_flow, _database, _provider, _args) {
        super();
        this.stateHandler = new SingleState();
        this.globalStateHandler = new GlobalState();
        this.dynamicBlacklist = new BlackList();
        this.generalArgs = {
            blackList: [],
            listEvents: {},
            delay: 0,
            globalState: {},
            extensions: undefined,
            queue: {
                timeout: 20000,
                concurrencyLimit: 15,
            },
            host: undefined,
        };
        /**
         * Event handler
         */
        this.listenerBusEvents = () => [
            {
                event: 'require_action',
                func: ({ instructions, title = '' }) => printer(instructions, title),
            },
            {
                event: 'notice',
                func: ({ instructions, title = '' }) => printer(instructions, title, 'bgMagenta'),
            },
            {
                event: 'ready',
                func: () => printer(['Tell a contact on your WhatsApp to write "hello"...'], '✅ Connected Provider', 'bgCyan'),
            },
            {
                event: 'auth_failure',
                func: ({ instructions }) => printer(instructions, '⚡⚡ ERROR AUTH ⚡⚡'),
            },
            {
                event: 'message',
                func: (msg) => {
                    return this.handleMsg({ ...msg, host: `${this.generalArgs?.host}` });
                },
            },
            {
                event: 'host',
                func: (payload) => this.setHostData(payload),
            },
        ];
        this.setHostData = (hostNumber) => {
            this.generalArgs.host = hostNumber.phone;
        };
        this.handleMsg = async (messageCtxInComing) => {
            logger.log(`[handleMsg]: `, messageCtxInComing);
            idleForCallback.stop(messageCtxInComing);
            const { body, from } = messageCtxInComing;
            let msgToSend = [];
            let endFlowFlag = false;
            const fallBackFlag = false;
            if (this.dynamicBlacklist.checkIf(from))
                return;
            if (!body)
                return;
            const prevMsg = await this.database.getPrevByNumber(from);
            const refToContinue = this.flowClass.findBySerialize(prevMsg?.refSerialize);
            if (prevMsg?.ref) {
                delete prevMsg._id;
                const ctxByNumber = toCtx({
                    body,
                    from,
                    prevRef: prevMsg.refSerialize,
                });
                await this.database.save(ctxByNumber);
            }
            // 📄 Mantener estado de conversacion por numero
            const state = {
                getMyState: this.stateHandler.getMyState(messageCtxInComing.from),
                get: this.stateHandler.get(messageCtxInComing.from),
                update: this.stateHandler.updateState(messageCtxInComing),
                clear: this.stateHandler.clear(messageCtxInComing.from),
            };
            // 📄 Mantener estado global
            const globalState = {
                get: this.globalStateHandler.get(),
                getAllState: this.globalStateHandler.getAllState,
                update: this.globalStateHandler.updateState(),
                clear: this.globalStateHandler.clear(),
            };
            const extensions = this.globalStateHandler.RAW;
            // 📄 Crar CTX de mensaje (uso private)
            const createCtxMessage = (payload, index = 0) => {
                const body = typeof payload === 'string' ? payload : payload?.body ?? payload?.answer;
                const media = payload?.media ?? null;
                const buttons = payload?.buttons ?? [];
                const capture = payload?.capture ?? false;
                const delay = payload?.delay ?? 0;
                const keyword = payload?.keyword ?? null;
                return toCtx({
                    body,
                    from,
                    keyword,
                    index,
                    options: { media, buttons, capture, delay },
                });
            };
            // 📄 Limpiar cola de procesos
            const clearQueue = () => {
                this.queuePrincipal.clearQueue(from);
                return;
            };
            // 📄 Finalizar flujo
            const endFlow = (flag, inRef) => async (message = null) => {
                flag.endFlow = true;
                endFlowFlag = true;
                if (message) {
                    this.sendProviderAndSave(from, createCtxMessage(message)).then(() => this.sendProviderAndSave(from, createCtxMessage({ ...message, keyword: `${inRef}`, answer: '__end_flow__' })));
                }
                else {
                    this.sendProviderAndSave(from, createCtxMessage({ ...message, keyword: `${inRef}`, answer: '__end_flow__' }));
                }
                clearQueue();
                return;
            };
            // 📄 Finalizar flujo (patch)
            const endFlowToGotoFlow = (flag) => async (messages = []) => {
                flag.endFlow = true;
                endFlowFlag = true;
                for (const iteratorCtxMessage of messages) {
                    const keyWord = Array.isArray(iteratorCtxMessage.keyword)
                        ? iteratorCtxMessage.keyword.join(' ')
                        : iteratorCtxMessage.keyword;
                    const scopeCtx = await resolveCbEveryCtx(iteratorCtxMessage, {
                        omitEndFlow: true,
                        idleCtx: !!iteratorCtxMessage?.options?.idle,
                        triggerKey: keyWord.startsWith('key_'),
                    });
                    if (scopeCtx?.endFlow)
                        break;
                }
                clearQueue();
                return;
            };
            // 📄 Esta funcion se encarga de enviar un array de mensajes dentro de este ctx
            const sendFlow = async (messageToSend, numberOrId, options = {}) => {
                options = { prev: prevMsg, forceQueue: false, ...options };
                const idleCtxQueue = idleForCallback.get({ from, inRef: prevMsg?.ref });
                const { ref: prevRef, options: prevOptions } = options.prev || {};
                const { capture, idle } = prevOptions || {};
                if (messageCtxInComing?.ref && idleCtxQueue && messageToSend.length) {
                    return;
                }
                if (capture && idle && messageToSend.length === 0) {
                    await cbEveryCtx(prevRef);
                    return;
                }
                if (capture && !idle) {
                    await cbEveryCtx(prevRef);
                }
                for (const ctxMessage of messageToSend) {
                    if (endFlowFlag) {
                        break;
                    }
                    const delayMs = ctxMessage?.options?.delay ?? this.generalArgs.delay ?? 0;
                    await delay(delayMs);
                    if (options.forceQueue) {
                        await handleForceQueue(ctxMessage, messageToSend, numberOrId, from);
                    }
                    await enqueueMsg(numberOrId, ctxMessage, from);
                }
            };
            // Se han extraído algunas funcionalidades en nuevas funciones para mejorar la legibilidad
            const handleForceQueue = async (_, messageToSend, numberOrId, from) => {
                const listIdsRefCallbacks = messageToSend.map((i) => i.ref);
                const listProcessWait = this.queuePrincipal.getIdsCallback(from);
                if (!listProcessWait.length) {
                    this.queuePrincipal.setIdsCallbacks(from, listIdsRefCallbacks);
                }
                else {
                    const lastMessage = messageToSend[messageToSend.length - 1];
                    await this.database.save({ ...lastMessage, from: numberOrId });
                    if (listProcessWait.includes(lastMessage.ref)) {
                        this.queuePrincipal.clearQueue(from);
                    }
                }
            };
            const enqueueMsg = async (numberOrId, ctxMessage, from) => {
                try {
                    await this.queuePrincipal.enqueue(from, async () => {
                        await this.sendProviderAndSave(numberOrId, ctxMessage)
                            .then(() => resolveCbEveryCtx(ctxMessage))
                            .catch((error) => {
                            logger.error(`Error en sendProviderAndSave (ID ${ctxMessage.ref}):`, error);
                            throw error;
                        });
                        logger.log(`[QUEUE_SE_ENVIO]: `, ctxMessage);
                    }, ctxMessage.ref);
                }
                catch (error) {
                    logger.error(`Error al encolar (ID ${ctxMessage.ref}):`, error);
                    throw error;
                }
            };
            const continueFlow = async (initRef = undefined) => {
                try {
                    const currentPrev = await this.database.getPrevByNumber(from);
                    if (!currentPrev?.keyword)
                        return;
                    let nextFlow = this.flowClass.find(refToContinue?.ref, true) || [];
                    if (initRef && !initRef?.idleFallBack) {
                        nextFlow = this.flowClass.find(initRef?.ref, true) || [];
                    }
                    const getContinueIndex = nextFlow.findIndex((msg) => msg.refSerialize === currentPrev?.refSerialize);
                    const indexToContinue = getContinueIndex !== -1 ? getContinueIndex : 0;
                    const filterNextFlow = nextFlow
                        .slice(indexToContinue)
                        .filter((i) => i.refSerialize !== currentPrev?.refSerialize);
                    const isContinueFlow = filterNextFlow.map((i) => i.keyword).includes(currentPrev?.ref);
                    if (!isContinueFlow) {
                        const refToContinueChild = this.flowClass.getRefToContinueChild(currentPrev?.keyword);
                        const flowStandaloneChild = this.flowClass.getFlowsChild();
                        const nextChildMessages = this.flowClass.find(refToContinueChild?.ref, true, flowStandaloneChild) || [];
                        if (nextChildMessages.length) {
                            return exportFunctionsSend(() => sendFlow(nextChildMessages, from, { prev: undefined }));
                        }
                        return exportFunctionsSend(() => sendFlow(filterNextFlow, from, { prev: undefined }));
                    }
                    if (initRef && !initRef?.idleFallBack) {
                        return exportFunctionsSend(() => sendFlow(filterNextFlow, from, { prev: undefined }));
                    }
                }
                catch (error) {
                    // Manejar errores aquí según tu lógica de manejo de errores.
                    console.error('Error en continueFlow:', error);
                }
            };
            // 📄 [options: fallBack]: esta funcion se encarga de repetir el ultimo mensaje
            const fallBack = (flag) => async (message = null) => {
                this.queuePrincipal.clearQueue(from);
                flag.fallBack = true;
                await this.sendProviderAndSave(from, {
                    ...prevMsg,
                    answer: typeof message === 'string' ? message : message?.body ?? prevMsg.answer,
                    options: {
                        ...prevMsg.options,
                        buttons: prevMsg.options?.buttons,
                    },
                });
                return;
            };
            const gotoFlow = (flag) => async (flowInstance, step = 0) => {
                idleForCallback.stop({ from });
                const promises = [];
                flag.gotoFlow = true;
                if (!flowInstance?.toJson) {
                    printer([
                        `Circular dependency detected.`,
                        `To avoid issues, we recommend using 'require'('./flow_path')`,
                        `Example:  gotoFlow(helloFlow) -->  gotoFlow(require('./flows/helloFlow.js'))`,
                        `https://bot-whatsapp.netlify.app/docs/goto-flow/`,
                    ], `POSSIBLE_CIRCULAR_DEPENDENCY`);
                    return;
                }
                await delay(flowInstance?.ctx?.options?.delay ?? 0);
                const flowTree = flowInstance.toJson();
                const flowParentId = flowTree[step];
                const parseListMsg = this.flowClass.find(flowParentId?.ref, true, flowTree);
                for (const msg of parseListMsg) {
                    const msgParse = this.flowClass.findSerializeByRef(msg?.ref);
                    const ctxMessage = { ...msgParse, ...msg };
                    await this.sendProviderAndSave(from, ctxMessage).then(() => promises.push(ctxMessage));
                }
                await endFlowToGotoFlow(flag)(promises);
                return;
            };
            // 📄 [options: flowDynamic]: esta funcion se encarga de responder un array de respuesta esta limitado a 5 mensajes
            // para evitar bloque de whatsapp
            const flowDynamic = (flag, inRef, privateOptions) => async (listMessages = [], options = { continue: true }) => {
                if (!options.hasOwnProperty('continue')) {
                    options = { ...options, continue: true };
                }
                flag.flowDynamic = true;
                if (!Array.isArray(listMessages)) {
                    listMessages = [{ body: listMessages, ...options }];
                }
                const parseListMsg = listMessages.map((opt, index) => {
                    const optParse = {
                        capture: false,
                        body: '',
                        buttons: [],
                        media: null,
                        delay: this.generalArgs.delay ?? 0,
                        keyword: null,
                        answer: undefined,
                    };
                    if (typeof opt === 'string') {
                        optParse.body = opt;
                    }
                    else {
                        optParse.body = opt?.body ?? ' ';
                        optParse.media = opt?.media ?? null;
                        optParse.buttons = opt?.buttons ?? [];
                        optParse.delay = opt?.delay ?? this.generalArgs.delay ?? 0;
                    }
                    return createCtxMessage(optParse, index);
                });
                // Si endFlowFlag existe y no se omite la finalización del flujo, no hacer nada.
                if (endFlowFlag && !privateOptions?.omitEndFlow) {
                    return;
                }
                for (const msg of parseListMsg) {
                    if (privateOptions?.idleCtx) {
                        continue; // Saltar al siguiente mensaje si se está en modo idleCtx.
                    }
                    const delayMs = msg?.options?.delay ?? this.generalArgs.delay ?? 0;
                    await delay(delayMs);
                    await this.sendProviderAndSave(from, msg);
                }
                if (options?.continue) {
                    await continueFlow();
                    return;
                }
                return;
            };
            // 📄 Se encarga de revisar si el contexto del mensaje tiene callback o idle
            const resolveCbEveryCtx = async (ctxMessage, options = { omitEndFlow: false, idleCtx: false, triggerKey: false }) => {
                if (!!ctxMessage?.options?.idle && !ctxMessage?.options?.capture) {
                    printer([
                        `The "idle" function will have no effect unless you enable the "capture:true" option.`,
                        `Please make sure to configure "capture:true" or remove the "idle" function`,
                    ], `IDLE ATTENTION`);
                    return;
                }
                if (ctxMessage?.options?.idle) {
                    const run = await cbEveryCtx(ctxMessage?.ref, { ...options, startIdleMs: ctxMessage?.options?.idle });
                    return run;
                }
                if (!ctxMessage?.options?.capture) {
                    const run = await cbEveryCtx(ctxMessage?.ref, options);
                    return run;
                }
            };
            // 📄 Se encarga de revisar si el contexto del mensaje tiene callback y ejecutarlo
            const cbEveryCtx = async (inRef, options = { startIdleMs: 0, omitEndFlow: false, idleCtx: false, triggerKey: false }) => {
                const flags = {
                    endFlow: false,
                    fallBack: false,
                    flowDynamic: false,
                    gotoFlow: false,
                };
                const provider = this.provider;
                const database = this.database;
                if (!this.flowClass.allCallbacks[inRef])
                    return Promise.resolve();
                /** argumentos que se exponen */
                const argsCb = {
                    database,
                    provider,
                    state,
                    globalState,
                    extensions,
                    blacklist: this.dynamicBlacklist,
                    queue: this.queuePrincipal,
                    idle: idleForCallback,
                    inRef,
                    fallBack: fallBack(flags),
                    flowDynamic: flowDynamic(flags, inRef, options),
                    endFlow: endFlow(flags, inRef),
                    gotoFlow: gotoFlow(flags),
                };
                const runContext = async (continueAfterIdle = false, overCtx = {}) => {
                    try {
                        messageCtxInComing = { ...messageCtxInComing, ...overCtx };
                        if (options?.idleCtx && !options?.triggerKey) {
                            return;
                        }
                        await this.flowClass.allCallbacks[inRef](messageCtxInComing, argsCb);
                        //Si no hay llamado de fallaback y no hay llamado de flowDynamic y no hay llamado de enflow EL flujo continua
                        if (continueAfterIdle) {
                            idleForCallback.stop({ from });
                            await continueFlow(overCtx);
                            return;
                        }
                        const ifContinue = !flags.endFlow && !flags.fallBack && !flags.flowDynamic;
                        if (ifContinue) {
                            idleForCallback.stop({ from });
                            await continueFlow();
                            return;
                        }
                    }
                    catch (error) {
                        return Promise.reject(error);
                    }
                };
                if (options.startIdleMs > 0) {
                    idleForCallback.setIdleTime({
                        from,
                        inRef,
                        timeInSeconds: options.startIdleMs / 1000,
                        cb: async (opts) => {
                            if (opts.next) {
                                await runContext(true, { idleFallBack: opts.next, ref: opts.inRef, body: opts.body });
                            }
                        },
                    });
                    return;
                }
                await runContext();
                return { ...flags };
            };
            const exportFunctionsSend = async (cb = () => Promise.resolve()) => {
                await cb();
                return {
                    createCtxMessage,
                    clearQueue,
                    endFlow,
                    sendFlow,
                    continueFlow,
                    fallBack,
                    gotoFlow,
                    flowDynamic,
                    resolveCbEveryCtx,
                    cbEveryCtx,
                };
            };
            // 📄🤘(tiene return) [options: nested(array)]: Si se tiene flujos hijos los implementa
            if (!endFlowFlag && prevMsg?.options?.nested?.length) {
                const nestedRef = prevMsg.options.nested;
                const flowStandalone = nestedRef.map((f) => ({
                    ...nestedRef.find((r) => r.refSerialize === f.refSerialize),
                }));
                msgToSend = this.flowClass.find(body, false, flowStandalone) || [];
                return exportFunctionsSend(() => sendFlow(msgToSend, from));
            }
            // 📄🤘(tiene return) Si el mensaje previo implementa capture
            if (!endFlowFlag && !prevMsg?.options?.nested?.length) {
                const typeCapture = typeof prevMsg?.options?.capture;
                if (typeCapture === 'boolean' && fallBackFlag) {
                    msgToSend = this.flowClass.find(refToContinue?.ref, true) || [];
                    return exportFunctionsSend(() => sendFlow(msgToSend, from, { forceQueue: true }));
                }
            }
            msgToSend = this.flowClass.find(body) || [];
            if (msgToSend.length) {
                return exportFunctionsSend(() => sendFlow(msgToSend, from));
            }
            if (!prevMsg?.options?.capture) {
                msgToSend = this.flowClass.find(this.generalArgs.listEvents.WELCOME) || [];
                if (LIST_REGEX.REGEX_EVENT_LOCATION.test(body)) {
                    msgToSend = this.flowClass.find(this.generalArgs.listEvents.LOCATION) || [];
                }
                if (LIST_REGEX.REGEX_EVENT_MEDIA.test(body)) {
                    msgToSend = this.flowClass.find(this.generalArgs.listEvents.MEDIA) || [];
                }
                if (LIST_REGEX.REGEX_EVENT_DOCUMENT.test(body)) {
                    msgToSend = this.flowClass.find(this.generalArgs.listEvents.DOCUMENT) || [];
                }
                if (LIST_REGEX.REGEX_EVENT_VOICE_NOTE.test(body)) {
                    msgToSend = this.flowClass.find(this.generalArgs.listEvents.VOICE_NOTE) || [];
                }
                if (LIST_REGEX.REGEX_EVENT_ORDER.test(body)) {
                    msgToSend = this.flowClass.find(this.generalArgs.listEvents.ORDER) || [];
                }
                if (LIST_REGEX.REGEX_EVENT_TEMPLATE.test(body)) {
                    msgToSend = this.flowClass.find(this.generalArgs.listEvents.TEMPLATE) || [];
                }
            }
            return exportFunctionsSend(() => sendFlow(msgToSend, from, { forceQueue: true }));
        };
        
        this.sendProviderAndSave = async (numberOrId, ctxMessage) => {
            try {
                const { answer } = ctxMessage;
                if (answer &&
                    answer.length &&
                    answer !== '__call_action__' &&
                    answer !== '__goto_flow__' &&
                    answer !== '__end_flow__') {
                    if (answer !== '__capture_only_intended__') {
                        await this.provider.sendMessage(numberOrId, answer, ctxMessage);
                        this.emit('send_message', { ...ctxMessage, from: numberOrId, answer });
                    }
                }
                await this.database.save({ ...ctxMessage, from: numberOrId });
                return Promise.resolve();
            }
            catch (err) {
                logger.log(`[ERROR ID (${ctxMessage.ref})]: `, err);
                return Promise.reject(err);
            }
        };
        
        this.sendFlowSimple = async (messageToSend, numberOrId) => {
            for (const ctxMessage of messageToSend) {
                const delayMs = ctxMessage?.options?.delay ?? this.generalArgs.delay ?? 0;
                await delay(delayMs);
                await this.queuePrincipal.enqueue(numberOrId, () => this.sendProviderAndSave(numberOrId, ctxMessage), ctxMessage.ref);
                // await queuePromises.dequeue()
            }
            return Promise.resolve;
        };
        
        this.httpServer = (port) => {
            this.provider.initAll(port, {
				extensions: this.generalArgs.extensions,
                blacklist: this.dynamicBlacklist,
                state: (number) => ({
                    getMyState: this.stateHandler.getMyState(number),
                    get: this.stateHandler.get(number),
                    update: this.stateHandler.updateState({ from: number }),
                    clear: this.stateHandler.clear(number),
                }),
                globalState: () => ({
                    get: this.globalStateHandler.get(),
                    getAllState: this.globalStateHandler.getAllState,
                    update: this.globalStateHandler.updateState(),
                    clear: this.globalStateHandler.clear(),
                }),
            });
        };
        
        this.handleCtx = (ctxPolka) => this.provider.inHandleCtx(ctxPolka);
        this.flowClass = _flow;
        this.database = _database;
        this.provider = _provider;
        this.generalArgs = { ...this.generalArgs, ..._args };
        this.dynamicBlacklist.add(this.generalArgs.blackList);
        this.queuePrincipal = new Queue(loggerQueue, this.generalArgs.queue.concurrencyLimit ?? 15, this.generalArgs.queue.timeout);
        this.globalStateHandler.updateState()(this.generalArgs.globalState);
        if (this.generalArgs.extensions)
            this.globalStateHandler.RAW = this.generalArgs.extensions;
        for (const { event, func } of this.listenerBusEvents()) {
            this.provider.on(event, func);
        }
    }
}

class MemoryDB {
    constructor() {
        this.listHistory = [];
    }
    /**
     *
     * @param from
     * @returns
     */
    async getPrevByNumber(from) {
        const history = this.listHistory
            .slice()
            .reverse()
            .filter((i) => !!i.keyword);
        return history.find((a) => a.from === from);
    }
    /**
     *
     * @param ctx
     */
    async save(ctx) {
        this.listHistory.push(ctx);
    }
}

class FlowClass {
    constructor(_flow) {
        if (!Array.isArray(_flow))
            throw new Error('Must be an array of flows');
        this.flowRaw = _flow;
        this.allCallbacks = flatObject(_flow);
        const mergeToJsonSerialize = _flow.map((flowItem) => flowItem.toJson()).flat(2);
        this.flowSerialize = toSerialize(mergeToJsonSerialize);
    }
    find(keyOrWord, symbol = false, overFlow = null) {
        let capture = false;
        const messages = [];
        let refSymbol = null;
        overFlow = overFlow ?? this.flowSerialize;
        const mapSensitive = (str, mapOptions) => {
            if (mapOptions.regex)
                return new Function(`return ${str}`)();
            const regexSensitive = mapOptions.sensitive ? 'g' : 'i';
            if (Array.isArray(str)) {
                const patterns = mapOptions.sensitive ? str.map((item) => `\\b${item}\\b`) : str;
                return new RegExp(patterns.join('|'), regexSensitive);
            }
            const pattern = mapOptions.sensitive ? `\\b${str}\\b` : str;
            return new RegExp(pattern, regexSensitive);
        };
        const findIn = (keyOrWord, symbol, flow) => {
            capture = refSymbol?.options?.capture || false;
            if (capture)
                return;
            if (symbol) {
                refSymbol = flow.find((c) => c.keyword === keyOrWord);
                if (refSymbol?.answer)
                    messages.push(refSymbol);
                if (refSymbol?.ref)
                    findIn(refSymbol.ref, true, flow);
            }
            else {
                refSymbol = flow.find((c) => {
                    const sensitive = c?.options?.sensitive || false;
                    const regex = c?.options?.regex || false;
                    return mapSensitive(c.keyword, { sensitive, regex }).test(keyOrWord);
                });
                if (refSymbol?.ref)
                    findIn(refSymbol.ref, true, flow);
            }
        };
        findIn(keyOrWord, symbol, overFlow);
        return messages;
    }
    findBySerialize(refSerialize, k = 0) {
        const index = this.flowSerialize.findIndex((r) => r.refSerialize === refSerialize);
        return this.flowSerialize[index - k];
    }
    findIndexByRef(ref) {
        return this.flowSerialize.findIndex((r) => r.ref === ref);
    }
    findSerializeByRef(ref) {
        return this.flowSerialize.find((r) => r.ref === ref);
    }
    findSerializeByKeyword(keyword) {
        return this.flowSerialize.find((r) => r.keyword === keyword);
    }
    getRefToContinueChild(keyword) {
        try {
            const flowChilds = this.flowSerialize.reduce((acc, cur) => {
                const merge = [...acc, cur?.options?.nested].flat(2);
                return merge;
            }, []);
            return flowChilds.filter((i) => !!i && i?.refSerialize === keyword).shift();
        }
        catch (e) {
            return undefined;
        }
    }
    getFlowsChild() {
        try {
            const flowChilds = this.flowSerialize
                .reduce((acc, cur) => {
                const merge = [...acc, cur?.options?.nested].flat(2);
                return merge;
            }, [])
                .filter((i) => !!i);
            return flowChilds;
        }
        catch (e) {
            return [];
        }
    }
}

var bodyParser = {exports: {}};

var relative = path.relative;

var depd_1 = depd;

var basePath = process.cwd();


function containsNamespace (str, namespace) {
  var vals = str.split(/[ ,]+/);
  var ns = String(namespace).toLowerCase();

  for (var i = 0; i < vals.length; i++) {
    var val = vals[i];

    // namespace contained
    if (val && (val === '*' || val.toLowerCase() === ns)) {
      return true
    }
  }

  return false
}

function convertDataDescriptorToAccessor (obj, prop, message) {
  var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
  var value = descriptor.value;

  descriptor.get = function getter () { return value };

  if (descriptor.writable) {
    descriptor.set = function setter (val) { return (value = val) };
  }

  delete descriptor.value;
  delete descriptor.writable;

  Object.defineProperty(obj, prop, descriptor);

  return descriptor
}

function createArgumentsString (arity) {
  var str = '';

  for (var i = 0; i < arity; i++) {
    str += ', arg' + i;
  }

  return str.substr(2)
}

function createStackString (stack) {
  var str = this.name + ': ' + this.namespace;

  if (this.message) {
    str += ' deprecated ' + this.message;
  }

  for (var i = 0; i < stack.length; i++) {
    str += '\n    at ' + stack[i].toString();
  }

  return str
}

function depd (namespace) {
  if (!namespace) {
    throw new TypeError('argument namespace is required')
  }

  var stack = getStack();
  var site = callSiteLocation(stack[1]);
  var file = site[0];

  function deprecate (message) {
    // call to self as log
    log.call(deprecate, message);
  }

  deprecate._file = file;
  deprecate._ignored = isignored(namespace);
  deprecate._namespace = namespace;
  deprecate._traced = istraced(namespace);
  deprecate._warned = Object.create(null);

  deprecate.function = wrapfunction;
  deprecate.property = wrapproperty;

  return deprecate
}

function eehaslisteners (emitter, type) {
  var count = typeof emitter.listenerCount !== 'function'
    ? emitter.listeners(type).length
    : emitter.listenerCount(type);

  return count > 0
}

function isignored (namespace) {
  if (process.noDeprecation) {
    // --no-deprecation support
    return true
  }

  var str = process.env.NO_DEPRECATION || '';

  // namespace ignored
  return containsNamespace(str, namespace)
}

function istraced (namespace) {
  if (process.traceDeprecation) {
    // --trace-deprecation support
    return true
  }

  var str = process.env.TRACE_DEPRECATION || '';

  // namespace traced
  return containsNamespace(str, namespace)
}


function log (message, site) {
  var haslisteners = eehaslisteners(process, 'deprecation');

  // abort early if no destination
  if (!haslisteners && this._ignored) {
    return
  }

  var caller;
  var callFile;
  var callSite;
  var depSite;
  var i = 0;
  var seen = false;
  var stack = getStack();
  var file = this._file;

  if (site) {
    // provided site
    depSite = site;
    callSite = callSiteLocation(stack[1]);
    callSite.name = depSite.name;
    file = callSite[0];
  } else {
    // get call site
    i = 2;
    depSite = callSiteLocation(stack[i]);
    callSite = depSite;
  }

  // get caller of deprecated thing in relation to file
  for (; i < stack.length; i++) {
    caller = callSiteLocation(stack[i]);
    callFile = caller[0];

    if (callFile === file) {
      seen = true;
    } else if (callFile === this._file) {
      file = this._file;
    } else if (seen) {
      break
    }
  }

  var key = caller
    ? depSite.join(':') + '__' + caller.join(':')
    : undefined;

  if (key !== undefined && key in this._warned) {
    // already warned
    return
  }

  this._warned[key] = true;

  // generate automatic message from call site
  var msg = message;
  if (!msg) {
    msg = callSite === depSite || !callSite.name
      ? defaultMessage(depSite)
      : defaultMessage(callSite);
  }

  // emit deprecation if listeners exist
  if (haslisteners) {
    var err = DeprecationError(this._namespace, msg, stack.slice(i));
    process.emit('deprecation', err);
    return
  }

  // format and write message
  var format = process.stderr.isTTY
    ? formatColor
    : formatPlain;
  var output = format.call(this, msg, caller, stack.slice(i));
  process.stderr.write(output + '\n', 'utf8');
}

function callSiteLocation (callSite) {
  var file = callSite.getFileName() || '<anonymous>';
  var line = callSite.getLineNumber();
  var colm = callSite.getColumnNumber();

  if (callSite.isEval()) {
    file = callSite.getEvalOrigin() + ', ' + file;
  }

  var site = [file, line, colm];

  site.callSite = callSite;
  site.name = callSite.getFunctionName();

  return site
}


function defaultMessage (site) {
  var callSite = site.callSite;
  var funcName = site.name;

  // make useful anonymous name
  if (!funcName) {
    funcName = '<anonymous@' + formatLocation(site) + '>';
  }

  var context = callSite.getThis();
  var typeName = context && callSite.getTypeName();

  // ignore useless type name
  if (typeName === 'Object') {
    typeName = undefined;
  }

  // make useful type name
  if (typeName === 'Function') {
    typeName = context.name || typeName;
  }

  return typeName && callSite.getMethodName()
    ? typeName + '.' + funcName
    : funcName
}

function formatPlain (msg, caller, stack) {
  var timestamp = new Date().toUTCString();

  var formatted = timestamp +
    ' ' + this._namespace +
    ' deprecated ' + msg;

  // add stack trace
  if (this._traced) {
    for (var i = 0; i < stack.length; i++) {
      formatted += '\n    at ' + stack[i].toString();
    }

    return formatted
  }

  if (caller) {
    formatted += ' at ' + formatLocation(caller);
  }

  return formatted
}

function formatColor (msg, caller, stack) {
  var formatted = '\x1b[36;1m' + this._namespace + '\x1b[22;39m' + // bold cyan
    ' \x1b[33;1mdeprecated\x1b[22;39m' + // bold yellow
    ' \x1b[0m' + msg + '\x1b[39m'; // reset

  // add stack trace
  if (this._traced) {
    for (var i = 0; i < stack.length; i++) {
      formatted += '\n    \x1b[36mat ' + stack[i].toString() + '\x1b[39m'; // cyan
    }

    return formatted
  }

  if (caller) {
    formatted += ' \x1b[36m' + formatLocation(caller) + '\x1b[39m'; // cyan
  }

  return formatted
}

function formatLocation (callSite) {
  return relative(basePath, callSite[0]) +
    ':' + callSite[1] +
    ':' + callSite[2]
}

function getStack () {
  var limit = Error.stackTraceLimit;
  var obj = {};
  var prep = Error.prepareStackTrace;

  Error.prepareStackTrace = prepareObjectStackTrace;
  Error.stackTraceLimit = Math.max(10, limit);

  // capture the stack
  Error.captureStackTrace(obj);

  // slice this function off the top
  var stack = obj.stack.slice(1);

  Error.prepareStackTrace = prep;
  Error.stackTraceLimit = limit;

  return stack
}

function prepareObjectStackTrace (obj, stack) {
  return stack
}

function wrapfunction (fn, message) {
  if (typeof fn !== 'function') {
    throw new TypeError('argument fn must be a function')
  }

  var args = createArgumentsString(fn.length);
  var stack = getStack();
  var site = callSiteLocation(stack[1]);

  site.name = fn.name;

  // eslint-disable-next-line no-new-func
  var deprecatedfn = new Function('fn', 'log', 'deprecate', 'message', 'site',
    '"use strict"\n' +
    'return function (' + args + ') {' +
    'log.call(deprecate, message, site)\n' +
    'return fn.apply(this, arguments)\n' +
    '}')(fn, log, this, message, site);

  return deprecatedfn
}

function wrapproperty (obj, prop, message) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw new TypeError('argument obj must be object')
  }

  var descriptor = Object.getOwnPropertyDescriptor(obj, prop);

  if (!descriptor) {
    throw new TypeError('must call property on owner object')
  }

  if (!descriptor.configurable) {
    throw new TypeError('property must be configurable')
  }

  var deprecate = this;
  var stack = getStack();
  var site = callSiteLocation(stack[1]);

  // set site name
  site.name = prop;

  // convert data descriptor
  if ('value' in descriptor) {
    descriptor = convertDataDescriptorToAccessor(obj, prop);
  }

  var get = descriptor.get;
  var set = descriptor.set;

  // wrap getter
  if (typeof get === 'function') {
    descriptor.get = function getter () {
      log.call(deprecate, message, site);
      return get.apply(this, arguments)
    };
  }

  // wrap setter
  if (typeof set === 'function') {
    descriptor.set = function setter () {
      log.call(deprecate, message, site);
      return set.apply(this, arguments)
    };
  }

  Object.defineProperty(obj, prop, descriptor);
}

function DeprecationError (namespace, message, stack) {
  var error = new Error();
  var stackString;

  Object.defineProperty(error, 'constructor', {
    value: DeprecationError
  });

  Object.defineProperty(error, 'message', {
    configurable: true,
    enumerable: false,
    value: message,
    writable: true
  });

  Object.defineProperty(error, 'name', {
    enumerable: false,
    configurable: true,
    value: 'DeprecationError',
    writable: true
  });

  Object.defineProperty(error, 'namespace', {
    configurable: true,
    enumerable: false,
    value: namespace,
    writable: true
  });

  Object.defineProperty(error, 'stack', {
    configurable: true,
    enumerable: false,
    get: function () {
      if (stackString !== undefined) {
        return stackString
      }

      // prepare stack trace
      return (stackString = createStackString.call(this, stack))
    },
    set: function setter (val) {
      stackString = val;
    }
  });

  return error
}

var bytes = {exports: {}};

var hasRequiredBytes;

function requireBytes () {
	if (hasRequiredBytes) return bytes.exports;
	hasRequiredBytes = 1;


	bytes.exports = bytes$1;
	bytes.exports.format = format;
	bytes.exports.parse = parse;

	var formatThousandsRegExp = /\B(?=(\d{3})+(?!\d))/g;

	var formatDecimalsRegExp = /(?:\.0*|(\.[^0]+)0+)$/;

	var map = {
	  b:  1,
	  kb: 1 << 10,
	  mb: 1 << 20,
	  gb: 1 << 30,
	  tb: Math.pow(1024, 4),
	  pb: Math.pow(1024, 5),
	};

	var parseRegExp = /^((-|\+)?(\d+(?:\.\d+)?)) *(kb|mb|gb|tb|pb)$/i;

	function bytes$1(value, options) {
	  if (typeof value === 'string') {
	    return parse(value);
	  }

	  if (typeof value === 'number') {
	    return format(value, options);
	  }

	  return null;
	}

	function format(value, options) {
	  if (!Number.isFinite(value)) {
	    return null;
	  }

	  var mag = Math.abs(value);
	  var thousandsSeparator = (options && options.thousandsSeparator) || '';
	  var unitSeparator = (options && options.unitSeparator) || '';
	  var decimalPlaces = (options && options.decimalPlaces !== undefined) ? options.decimalPlaces : 2;
	  var fixedDecimals = Boolean(options && options.fixedDecimals);
	  var unit = (options && options.unit) || '';

	  if (!unit || !map[unit.toLowerCase()]) {
	    if (mag >= map.pb) {
	      unit = 'PB';
	    } else if (mag >= map.tb) {
	      unit = 'TB';
	    } else if (mag >= map.gb) {
	      unit = 'GB';
	    } else if (mag >= map.mb) {
	      unit = 'MB';
	    } else if (mag >= map.kb) {
	      unit = 'KB';
	    } else {
	      unit = 'B';
	    }
	  }

	  var val = value / map[unit.toLowerCase()];
	  var str = val.toFixed(decimalPlaces);

	  if (!fixedDecimals) {
	    str = str.replace(formatDecimalsRegExp, '$1');
	  }

	  if (thousandsSeparator) {
	    str = str.split('.').map(function (s, i) {
	      return i === 0
	        ? s.replace(formatThousandsRegExp, thousandsSeparator)
	        : s
	    }).join('.');
	  }

	  return str + unitSeparator + unit;
	}

	function parse(val) {
	  if (typeof val === 'number' && !isNaN(val)) {
	    return val;
	  }

	  if (typeof val !== 'string') {
	    return null;
	  }

	  // Test if the string passed is valid
	  var results = parseRegExp.exec(val);
	  var floatValue;
	  var unit = 'b';

	  if (!results) {
	    // Nothing could be extracted from the given string
	    floatValue = parseInt(val, 10);
	    unit = 'b';
	  } else {
	    // Retrieve the value and the unit
	    floatValue = parseFloat(results[1]);
	    unit = results[4].toLowerCase();
	  }

	  if (isNaN(floatValue)) {
	    return null;
	  }

	  return Math.floor(map[unit] * floatValue);
	}
	return bytes.exports;
}

var contentType = {};


var hasRequiredContentType;

function requireContentType () {
	if (hasRequiredContentType) return contentType;
	hasRequiredContentType = 1;

	var PARAM_REGEXP = /; *([!#$%&'*+.^_`|~0-9A-Za-z-]+) *= *("(?:[\u000b\u0020\u0021\u0023-\u005b\u005d-\u007e\u0080-\u00ff]|\\[\u000b\u0020-\u00ff])*"|[!#$%&'*+.^_`|~0-9A-Za-z-]+) */g; // eslint-disable-line no-control-regex
	var TEXT_REGEXP = /^[\u000b\u0020-\u007e\u0080-\u00ff]+$/; // eslint-disable-line no-control-regex
	var TOKEN_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
	var QESC_REGEXP = /\\([\u000b\u0020-\u00ff])/g; // eslint-disable-line no-control-regex

	var QUOTE_REGEXP = /([\\"])/g;

	var TYPE_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

	contentType.format = format;
	contentType.parse = parse;

	function format (obj) {
	  if (!obj || typeof obj !== 'object') {
	    throw new TypeError('argument obj is required')
	  }

	  var parameters = obj.parameters;
	  var type = obj.type;

	  if (!type || !TYPE_REGEXP.test(type)) {
	    throw new TypeError('invalid type')
	  }

	  var string = type;

	  // append parameters
	  if (parameters && typeof parameters === 'object') {
	    var param;
	    var params = Object.keys(parameters).sort();

	    for (var i = 0; i < params.length; i++) {
	      param = params[i];

	      if (!TOKEN_REGEXP.test(param)) {
	        throw new TypeError('invalid parameter name')
	      }

	      string += '; ' + param + '=' + qstring(parameters[param]);
	    }
	  }

	  return string
	}

	function parse (string) {
	  if (!string) {
	    throw new TypeError('argument string is required')
	  }

	  // support req/res-like objects as argument
	  var header = typeof string === 'object'
	    ? getcontenttype(string)
	    : string;

	  if (typeof header !== 'string') {
	    throw new TypeError('argument string is required to be a string')
	  }

	  var index = header.indexOf(';');
	  var type = index !== -1
	    ? header.slice(0, index).trim()
	    : header.trim();

	  if (!TYPE_REGEXP.test(type)) {
	    throw new TypeError('invalid media type')
	  }

	  var obj = new ContentType(type.toLowerCase());

	  // parse parameters
	  if (index !== -1) {
	    var key;
	    var match;
	    var value;

	    PARAM_REGEXP.lastIndex = index;

	    while ((match = PARAM_REGEXP.exec(header))) {
	      if (match.index !== index) {
	        throw new TypeError('invalid parameter format')
	      }

	      index += match[0].length;
	      key = match[1].toLowerCase();
	      value = match[2];

	      if (value.charCodeAt(0) === 0x22 /* " */) {
	        // remove quotes
	        value = value.slice(1, -1);

	        // remove escapes
	        if (value.indexOf('\\') !== -1) {
	          value = value.replace(QESC_REGEXP, '$1');
	        }
	      }

	      obj.parameters[key] = value;
	    }

	    if (index !== header.length) {
	      throw new TypeError('invalid parameter format')
	    }
	  }

	  return obj
	}

	function getcontenttype (obj) {
	  var header;

	  if (typeof obj.getHeader === 'function') {
	    // res-like
	    header = obj.getHeader('content-type');
	  } else if (typeof obj.headers === 'object') {
	    // req-like
	    header = obj.headers && obj.headers['content-type'];
	  }

	  if (typeof header !== 'string') {
	    throw new TypeError('content-type header is missing from object')
	  }

	  return header
	}

	function qstring (val) {
	  var str = String(val);

	  // no need to quote tokens
	  if (TOKEN_REGEXP.test(str)) {
	    return str
	  }

	  if (str.length > 0 && !TEXT_REGEXP.test(str)) {
	    throw new TypeError('invalid parameter value')
	  }

	  return '"' + str.replace(QUOTE_REGEXP, '\\$1') + '"'
	}

	function ContentType (type) {
	  this.parameters = Object.create(null);
	  this.type = type;
	}
	return contentType;
}

var httpErrors = {exports: {}};

var setprototypeof;
var hasRequiredSetprototypeof;

function requireSetprototypeof () {
	if (hasRequiredSetprototypeof) return setprototypeof;
	hasRequiredSetprototypeof = 1;
	/* eslint no-proto: 0 */
	setprototypeof = Object.setPrototypeOf || ({ __proto__: [] } instanceof Array ? setProtoOf : mixinProperties);

	function setProtoOf (obj, proto) {
	  obj.__proto__ = proto;
	  return obj
	}

	function mixinProperties (obj, proto) {
	  for (var prop in proto) {
	    if (!Object.prototype.hasOwnProperty.call(obj, prop)) {
	      obj[prop] = proto[prop];
	    }
	  }
	  return obj
	}
	return setprototypeof;
}

var require$$0$2 = {
	"100": "Continue",
	"101": "Switching Protocols",
	"102": "Processing",
	"103": "Early Hints",
	"200": "OK",
	"201": "Created",
	"202": "Accepted",
	"203": "Non-Authoritative Information",
	"204": "No Content",
	"205": "Reset Content",
	"206": "Partial Content",
	"207": "Multi-Status",
	"208": "Already Reported",
	"226": "IM Used",
	"300": "Multiple Choices",
	"301": "Moved Permanently",
	"302": "Found",
	"303": "See Other",
	"304": "Not Modified",
	"305": "Use Proxy",
	"307": "Temporary Redirect",
	"308": "Permanent Redirect",
	"400": "Bad Request",
	"401": "Unauthorized",
	"402": "Payment Required",
	"403": "Forbidden",
	"404": "Not Found",
	"405": "Method Not Allowed",
	"406": "Not Acceptable",
	"407": "Proxy Authentication Required",
	"408": "Request Timeout",
	"409": "Conflict",
	"410": "Gone",
	"411": "Length Required",
	"412": "Precondition Failed",
	"413": "Payload Too Large",
	"414": "URI Too Long",
	"415": "Unsupported Media Type",
	"416": "Range Not Satisfiable",
	"417": "Expectation Failed",
	"418": "I'm a Teapot",
	"421": "Misdirected Request",
	"422": "Unprocessable Entity",
	"423": "Locked",
	"424": "Failed Dependency",
	"425": "Too Early",
	"426": "Upgrade Required",
	"428": "Precondition Required",
	"429": "Too Many Requests",
	"431": "Request Header Fields Too Large",
	"451": "Unavailable For Legal Reasons",
	"500": "Internal Server Error",
	"501": "Not Implemented",
	"502": "Bad Gateway",
	"503": "Service Unavailable",
	"504": "Gateway Timeout",
	"505": "HTTP Version Not Supported",
	"506": "Variant Also Negotiates",
	"507": "Insufficient Storage",
	"508": "Loop Detected",
	"509": "Bandwidth Limit Exceeded",
	"510": "Not Extended",
	"511": "Network Authentication Required"
};

var statuses;
var hasRequiredStatuses;

function requireStatuses () {
	if (hasRequiredStatuses) return statuses;
	hasRequiredStatuses = 1;

	var codes = require$$0$2;

	statuses = status;

	// status code to message map
	status.message = codes;

	// status message (lower-case) to code map
	status.code = createMessageToStatusCodeMap(codes);

	// array of status codes
	status.codes = createStatusCodeList(codes);

	// status codes for redirects
	status.redirect = {
	  300: true,
	  301: true,
	  302: true,
	  303: true,
	  305: true,
	  307: true,
	  308: true
	};

	// status codes for empty bodies
	status.empty = {
	  204: true,
	  205: true,
	  304: true
	};

	// status codes for when you should retry the request
	status.retry = {
	  502: true,
	  503: true,
	  504: true
	};

	function createMessageToStatusCodeMap (codes) {
	  var map = {};

	  Object.keys(codes).forEach(function forEachCode (code) {
	    var message = codes[code];
	    var status = Number(code);

	    // populate map
	    map[message.toLowerCase()] = status;
	  });

	  return map
	}

	function createStatusCodeList (codes) {
	  return Object.keys(codes).map(function mapCode (code) {
	    return Number(code)
	  })
	}

	function getStatusCode (message) {
	  var msg = message.toLowerCase();

	  if (!Object.prototype.hasOwnProperty.call(status.code, msg)) {
	    throw new Error('invalid status message: "' + message + '"')
	  }

	  return status.code[msg]
	}

	function getStatusMessage (code) {
	  if (!Object.prototype.hasOwnProperty.call(status.message, code)) {
	    throw new Error('invalid status code: ' + code)
	  }

	  return status.message[code]
	}

	function status (code) {
	  if (typeof code === 'number') {
	    return getStatusMessage(code)
	  }

	  if (typeof code !== 'string') {
	    throw new TypeError('code must be a number or string')
	  }

	  // '403'
	  var n = parseInt(code, 10);
	  if (!isNaN(n)) {
	    return getStatusMessage(n)
	  }

	  return getStatusCode(code)
	}
	return statuses;
}

var inherits = {exports: {}};

var inherits_browser = {exports: {}};

var hasRequiredInherits_browser;

function requireInherits_browser () {
	if (hasRequiredInherits_browser) return inherits_browser.exports;
	hasRequiredInherits_browser = 1;
	if (typeof Object.create === 'function') {
	  // implementation from standard node.js 'util' module
	  inherits_browser.exports = function inherits(ctor, superCtor) {
	    if (superCtor) {
	      ctor.super_ = superCtor;
	      ctor.prototype = Object.create(superCtor.prototype, {
	        constructor: {
	          value: ctor,
	          enumerable: false,
	          writable: true,
	          configurable: true
	        }
	      });
	    }
	  };
	} else {
	  // old school shim for old browsers
	  inherits_browser.exports = function inherits(ctor, superCtor) {
	    if (superCtor) {
	      ctor.super_ = superCtor;
	      var TempCtor = function () {};
	      TempCtor.prototype = superCtor.prototype;
	      ctor.prototype = new TempCtor();
	      ctor.prototype.constructor = ctor;
	    }
	  };
	}
	return inherits_browser.exports;
}

var hasRequiredInherits;

function requireInherits () {
	if (hasRequiredInherits) return inherits.exports;
	hasRequiredInherits = 1;
	try {
	  var util = require('util');
const fs = require('fs');
	  /* istanbul ignore next */
	  if (typeof util.inherits !== 'function') throw '';
	  inherits.exports = util.inherits;
	} catch (e) {
	  /* istanbul ignore next */
	  inherits.exports = requireInherits_browser();
	}
	return inherits.exports;
}

var toidentifier;
var hasRequiredToidentifier;

function requireToidentifier () {
	if (hasRequiredToidentifier) return toidentifier;
	hasRequiredToidentifier = 1;

	toidentifier = toIdentifier;

	function toIdentifier (str) {
	  return str
	    .split(' ')
	    .map(function (token) {
	      return token.slice(0, 1).toUpperCase() + token.slice(1)
	    })
	    .join('')
	    .replace(/[^ _0-9a-z]/gi, '')
	}
	return toidentifier;
}

var hasRequiredHttpErrors;

function requireHttpErrors () {
	if (hasRequiredHttpErrors) return httpErrors.exports;
	hasRequiredHttpErrors = 1;
	(function (module) {

		/**
		 * Module dependencies.
		 * @private
		 */

		var deprecate = depd_1('http-errors');
		var setPrototypeOf = requireSetprototypeof();
		var statuses = requireStatuses();
		var inherits = requireInherits();
		var toIdentifier = requireToidentifier();

		/**
		 * Module exports.
		 * @public
		 */

		module.exports = createError;
		module.exports.HttpError = createHttpErrorConstructor();
		module.exports.isHttpError = createIsHttpErrorFunction(module.exports.HttpError);

		// Populate exports for all constructors
		populateConstructorExports(module.exports, statuses.codes, module.exports.HttpError);

		/**
		 * Get the code class of a status code.
		 * @private
		 */

		function codeClass (status) {
		  return Number(String(status).charAt(0) + '00')
		}

		/**
		 * Create a new HTTP Error.
		 *
		 * @returns {Error}
		 * @public
		 */

		function createError () {
		  // so much arity going on ~_~
		  var err;
		  var msg;
		  var status = 500;
		  var props = {};
		  for (var i = 0; i < arguments.length; i++) {
		    var arg = arguments[i];
		    var type = typeof arg;
		    if (type === 'object' && arg instanceof Error) {
		      err = arg;
		      status = err.status || err.statusCode || status;
		    } else if (type === 'number' && i === 0) {
		      status = arg;
		    } else if (type === 'string') {
		      msg = arg;
		    } else if (type === 'object') {
		      props = arg;
		    } else {
		      throw new TypeError('argument #' + (i + 1) + ' unsupported type ' + type)
		    }
		  }

		  if (typeof status === 'number' && (status < 400 || status >= 600)) {
		    deprecate('non-error status code; use only 4xx or 5xx status codes');
		  }

		  if (typeof status !== 'number' ||
		    (!statuses.message[status] && (status < 400 || status >= 600))) {
		    status = 500;
		  }

		  // constructor
		  var HttpError = createError[status] || createError[codeClass(status)];

		  if (!err) {
		    // create error
		    err = HttpError
		      ? new HttpError(msg)
		      : new Error(msg || statuses.message[status]);
		    Error.captureStackTrace(err, createError);
		  }

		  if (!HttpError || !(err instanceof HttpError) || err.status !== status) {
		    // add properties to generic error
		    err.expose = status < 500;
		    err.status = err.statusCode = status;
		  }

		  for (var key in props) {
		    if (key !== 'status' && key !== 'statusCode') {
		      err[key] = props[key];
		    }
		  }

		  return err
		}

		/**
		 * Create HTTP error abstract base class.
		 * @private
		 */

		function createHttpErrorConstructor () {
		  function HttpError () {
		    throw new TypeError('cannot construct abstract class')
		  }

		  inherits(HttpError, Error);

		  return HttpError
		}

		/**
		 * Create a constructor for a client error.
		 * @private
		 */

		function createClientErrorConstructor (HttpError, name, code) {
		  var className = toClassName(name);

		  function ClientError (message) {
		    // create the error object
		    var msg = message != null ? message : statuses.message[code];
		    var err = new Error(msg);

		    // capture a stack trace to the construction point
		    Error.captureStackTrace(err, ClientError);

		    // adjust the [[Prototype]]
		    setPrototypeOf(err, ClientError.prototype);

		    // redefine the error message
		    Object.defineProperty(err, 'message', {
		      enumerable: true,
		      configurable: true,
		      value: msg,
		      writable: true
		    });

		    // redefine the error name
		    Object.defineProperty(err, 'name', {
		      enumerable: false,
		      configurable: true,
		      value: className,
		      writable: true
		    });

		    return err
		  }

		  inherits(ClientError, HttpError);
		  nameFunc(ClientError, className);

		  ClientError.prototype.status = code;
		  ClientError.prototype.statusCode = code;
		  ClientError.prototype.expose = true;

		  return ClientError
		}

		/**
		 * Create function to test is a value is a HttpError.
		 * @private
		 */

		function createIsHttpErrorFunction (HttpError) {
		  return function isHttpError (val) {
		    if (!val || typeof val !== 'object') {
		      return false
		    }

		    if (val instanceof HttpError) {
		      return true
		    }

		    return val instanceof Error &&
		      typeof val.expose === 'boolean' &&
		      typeof val.statusCode === 'number' && val.status === val.statusCode
		  }
		}

		/**
		 * Create a constructor for a server error.
		 * @private
		 */

		function createServerErrorConstructor (HttpError, name, code) {
		  var className = toClassName(name);

		  function ServerError (message) {
		    // create the error object
		    var msg = message != null ? message : statuses.message[code];
		    var err = new Error(msg);

		    // capture a stack trace to the construction point
		    Error.captureStackTrace(err, ServerError);

		    // adjust the [[Prototype]]
		    setPrototypeOf(err, ServerError.prototype);

		    // redefine the error message
		    Object.defineProperty(err, 'message', {
		      enumerable: true,
		      configurable: true,
		      value: msg,
		      writable: true
		    });

		    // redefine the error name
		    Object.defineProperty(err, 'name', {
		      enumerable: false,
		      configurable: true,
		      value: className,
		      writable: true
		    });

		    return err
		  }

		  inherits(ServerError, HttpError);
		  nameFunc(ServerError, className);

		  ServerError.prototype.status = code;
		  ServerError.prototype.statusCode = code;
		  ServerError.prototype.expose = false;

		  return ServerError
		}

		/**
		 * Set the name of a function, if possible.
		 * @private
		 */

		function nameFunc (func, name) {
		  var desc = Object.getOwnPropertyDescriptor(func, 'name');

		  if (desc && desc.configurable) {
		    desc.value = name;
		    Object.defineProperty(func, 'name', desc);
		  }
		}

		/**
		 * Populate the exports object with constructors for every error class.
		 * @private
		 */

		function populateConstructorExports (exports, codes, HttpError) {
		  codes.forEach(function forEachCode (code) {
		    var CodeError;
		    var name = toIdentifier(statuses.message[code]);

		    switch (codeClass(code)) {
		      case 400:
		        CodeError = createClientErrorConstructor(HttpError, name, code);
		        break
		      case 500:
		        CodeError = createServerErrorConstructor(HttpError, name, code);
		        break
		    }

		    if (CodeError) {
		      // export the constructor
		      exports[code] = CodeError;
		      exports[name] = CodeError;
		    }
		  });
		}

		/**
		 * Get a class name from a name identifier.
		 * @private
		 */

		function toClassName (name) {
		  return name.substr(-5) !== 'Error'
		    ? name + 'Error'
		    : name
		} 
	} (httpErrors));
	return httpErrors.exports;
}

var src = {exports: {}};

var browser = {exports: {}};

var debug = {exports: {}};

var ms;
var hasRequiredMs;

function requireMs () {
	if (hasRequiredMs) return ms;
	hasRequiredMs = 1;
	var s = 1000;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var y = d * 365.25;

	
	ms = function(val, options) {
	  options = options || {};
	  var type = typeof val;
	  if (type === 'string' && val.length > 0) {
	    return parse(val);
	  } else if (type === 'number' && isNaN(val) === false) {
	    return options.long ? fmtLong(val) : fmtShort(val);
	  }
	  throw new Error(
	    'val is not a non-empty string or a valid number. val=' +
	      JSON.stringify(val)
	  );
	};

	function parse(str) {
	  str = String(str);
	  if (str.length > 100) {
	    return;
	  }
	  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
	    str
	  );
	  if (!match) {
	    return;
	  }
	  var n = parseFloat(match[1]);
	  var type = (match[2] || 'ms').toLowerCase();
	  switch (type) {
	    case 'years':
	    case 'year':
	    case 'yrs':
	    case 'yr':
	    case 'y':
	      return n * y;
	    case 'days':
	    case 'day':
	    case 'd':
	      return n * d;
	    case 'hours':
	    case 'hour':
	    case 'hrs':
	    case 'hr':
	    case 'h':
	      return n * h;
	    case 'minutes':
	    case 'minute':
	    case 'mins':
	    case 'min':
	    case 'm':
	      return n * m;
	    case 'seconds':
	    case 'second':
	    case 'secs':
	    case 'sec':
	    case 's':
	      return n * s;
	    case 'milliseconds':
	    case 'millisecond':
	    case 'msecs':
	    case 'msec':
	    case 'ms':
	      return n;
	    default:
	      return undefined;
	  }
	}

	function fmtShort(ms) {
	  if (ms >= d) {
	    return Math.round(ms / d) + 'd';
	  }
	  if (ms >= h) {
	    return Math.round(ms / h) + 'h';
	  }
	  if (ms >= m) {
	    return Math.round(ms / m) + 'm';
	  }
	  if (ms >= s) {
	    return Math.round(ms / s) + 's';
	  }
	  return ms + 'ms';
	}
	
	function fmtLong(ms) {
	  return plural(ms, d, 'day') ||
	    plural(ms, h, 'hour') ||
	    plural(ms, m, 'minute') ||
	    plural(ms, s, 'second') ||
	    ms + ' ms';
	}

	function plural(ms, n, name) {
	  if (ms < n) {
	    return;
	  }
	  if (ms < n * 1.5) {
	    return Math.floor(ms / n) + ' ' + name;
	  }
	  return Math.ceil(ms / n) + ' ' + name + 's';
	}
	return ms;
}

var hasRequiredDebug;

function requireDebug () {
	if (hasRequiredDebug) return debug.exports;
	hasRequiredDebug = 1;
	(function (module, exports) {
		/**
		 * This is the common logic for both the Node.js and web browser
		 * implementations of `debug()`.
		 *
		 * Expose `debug()` as the module.
		 */

		exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
		exports.coerce = coerce;
		exports.disable = disable;
		exports.enable = enable;
		exports.enabled = enabled;
		exports.humanize = requireMs();

		/**
		 * The currently active debug mode names, and names to skip.
		 */

		exports.names = [];
		exports.skips = [];

		/**
		 * Map of special "%n" handling functions, for the debug "format" argument.
		 *
		 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
		 */

		exports.formatters = {};

		/**
		 * Previous log timestamp.
		 */

		var prevTime;

		/**
		 * Select a color.
		 * @param {String} namespace
		 * @return {Number}
		 * @api private
		 */

		function selectColor(namespace) {
		  var hash = 0, i;

		  for (i in namespace) {
		    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
		    hash |= 0; // Convert to 32bit integer
		  }

		  return exports.colors[Math.abs(hash) % exports.colors.length];
		}

		/**
		 * Create a debugger with the given `namespace`.
		 *
		 * @param {String} namespace
		 * @return {Function}
		 * @api public
		 */

		function createDebug(namespace) {

		  function debug() {
		    // disabled?
		    if (!debug.enabled) return;

		    var self = debug;

		    // set `diff` timestamp
		    var curr = +new Date();
		    var ms = curr - (prevTime || curr);
		    self.diff = ms;
		    self.prev = prevTime;
		    self.curr = curr;
		    prevTime = curr;

		    // turn the `arguments` into a proper Array
		    var args = new Array(arguments.length);
		    for (var i = 0; i < args.length; i++) {
		      args[i] = arguments[i];
		    }

		    args[0] = exports.coerce(args[0]);

		    if ('string' !== typeof args[0]) {
		      // anything else let's inspect with %O
		      args.unshift('%O');
		    }

		    // apply any `formatters` transformations
		    var index = 0;
		    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
		      // if we encounter an escaped % then don't increase the array index
		      if (match === '%%') return match;
		      index++;
		      var formatter = exports.formatters[format];
		      if ('function' === typeof formatter) {
		        var val = args[index];
		        match = formatter.call(self, val);

		        // now we need to remove `args[index]` since it's inlined in the `format`
		        args.splice(index, 1);
		        index--;
		      }
		      return match;
		    });

		    // apply env-specific formatting (colors, etc.)
		    exports.formatArgs.call(self, args);

		    var logFn = debug.log || exports.log || console.log.bind(console);
		    logFn.apply(self, args);
		  }

		  debug.namespace = namespace;
		  debug.enabled = exports.enabled(namespace);
		  debug.useColors = exports.useColors();
		  debug.color = selectColor(namespace);

		  // env-specific initialization logic for debug instances
		  if ('function' === typeof exports.init) {
		    exports.init(debug);
		  }

		  return debug;
		}

		/**
		 * Enables a debug mode by namespaces. This can include modes
		 * separated by a colon and wildcards.
		 *
		 * @param {String} namespaces
		 * @api public
		 */

		function enable(namespaces) {
		  exports.save(namespaces);

		  exports.names = [];
		  exports.skips = [];

		  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
		  var len = split.length;

		  for (var i = 0; i < len; i++) {
		    if (!split[i]) continue; // ignore empty strings
		    namespaces = split[i].replace(/\*/g, '.*?');
		    if (namespaces[0] === '-') {
		      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
		    } else {
		      exports.names.push(new RegExp('^' + namespaces + '$'));
		    }
		  }
		}

		/**
		 * Disable debug output.
		 *
		 * @api public
		 */

		function disable() {
		  exports.enable('');
		}

		/**
		 * Returns true if the given mode name is enabled, false otherwise.
		 *
		 * @param {String} name
		 * @return {Boolean}
		 * @api public
		 */

		function enabled(name) {
		  var i, len;
		  for (i = 0, len = exports.skips.length; i < len; i++) {
		    if (exports.skips[i].test(name)) {
		      return false;
		    }
		  }
		  for (i = 0, len = exports.names.length; i < len; i++) {
		    if (exports.names[i].test(name)) {
		      return true;
		    }
		  }
		  return false;
		}

		/**
		 * Coerce `val`.
		 *
		 * @param {Mixed} val
		 * @return {Mixed}
		 * @api private
		 */

		function coerce(val) {
		  if (val instanceof Error) return val.stack || val.message;
		  return val;
		} 
	} (debug, debug.exports));
	return debug.exports;
}


var hasRequiredBrowser;

function requireBrowser () {
	if (hasRequiredBrowser) return browser.exports;
	hasRequiredBrowser = 1;
	(function (module, exports) {
		exports = module.exports = requireDebug();
		exports.log = log;
		exports.formatArgs = formatArgs;
		exports.save = save;
		exports.load = load;
		exports.useColors = useColors;
		exports.storage = 'undefined' != typeof chrome
		               && 'undefined' != typeof chrome.storage
		                  ? chrome.storage.local
		                  : localstorage();

		/**
		 * Colors.
		 */

		exports.colors = [
		  'lightseagreen',
		  'forestgreen',
		  'goldenrod',
		  'dodgerblue',
		  'darkorchid',
		  'crimson'
		];

		function useColors() {
		  // NB: In an Electron preload script, document will be defined but not fully
		  // initialized. Since we know we're in Chrome, we'll just detect this case
		  // explicitly
		  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
		    return true;
		  }

		  // is webkit? http://stackoverflow.com/a/16459606/376773
		  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
		  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
		    // is firebug? http://stackoverflow.com/a/398120/376773
		    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
		    // is firefox >= v31?
		    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
		    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
		    // double check webkit in userAgent just in case we are in a worker
		    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
		}

		exports.formatters.j = function(v) {
		  try {
		    return JSON.stringify(v);
		  } catch (err) {
		    return '[UnexpectedJSONParseError]: ' + err.message;
		  }
		};

		function formatArgs(args) {
		  var useColors = this.useColors;

		  args[0] = (useColors ? '%c' : '')
		    + this.namespace
		    + (useColors ? ' %c' : ' ')
		    + args[0]
		    + (useColors ? '%c ' : ' ')
		    + '+' + exports.humanize(this.diff);

		  if (!useColors) return;

		  var c = 'color: ' + this.color;
		  args.splice(1, 0, c, 'color: inherit');

		  var index = 0;
		  var lastC = 0;
		  args[0].replace(/%[a-zA-Z%]/g, function(match) {
		    if ('%%' === match) return;
		    index++;
		    if ('%c' === match) {
		      // we only are interested in the *last* %c
		      // (the user may have provided their own)
		      lastC = index;
		    }
		  });

		  args.splice(lastC, 0, c);
		}

		function log() {
		  // this hackery is required for IE8/9, where
		  // the `console.log` function doesn't have 'apply'
		  return 'object' === typeof console
		    && console.log
		    && Function.prototype.apply.call(console.log, console, arguments);
		}

		function save(namespaces) {
		  try {
		    if (null == namespaces) {
		      exports.storage.removeItem('debug');
		    } else {
		      exports.storage.debug = namespaces;
		    }
		  } catch(e) {}
		}

		function load() {
		  var r;
		  try {
		    r = exports.storage.debug;
		  } catch(e) {}

		  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
		  if (!r && typeof process !== 'undefined' && 'env' in process) {
		    r = process.env.DEBUG;
		  }

		  return r;
		}
		exports.enable(load());

		function localstorage() {
		  try {
		    return window.localStorage;
		  } catch (e) {}
		} 
	} (browser, browser.exports));
	return browser.exports;
}

var node = {exports: {}};

var hasRequiredNode;

function requireNode () {
	if (hasRequiredNode) return node.exports;
	hasRequiredNode = 1;
	(function (module, exports) {
		var tty = require$$0$4;
		var util = require$$1$1;

		/**
		 * This is the Node.js implementation of `debug()`.
		 *
		 * Expose `debug()` as the module.
		 */

		exports = module.exports = requireDebug();
		exports.init = init;
		exports.log = log;
		exports.formatArgs = formatArgs;
		exports.save = save;
		exports.load = load;
		exports.useColors = useColors;

		/**
		 * Colors.
		 */

		exports.colors = [6, 2, 3, 4, 5, 1];

		/**
		 * Build up the default `inspectOpts` object from the environment variables.
		 *
		 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
		 */

		exports.inspectOpts = Object.keys(process.env).filter(function (key) {
		  return /^debug_/i.test(key);
		}).reduce(function (obj, key) {
		  // camel-case
		  var prop = key
		    .substring(6)
		    .toLowerCase()
		    .replace(/_([a-z])/g, function (_, k) { return k.toUpperCase() });

		  // coerce string value into JS value
		  var val = process.env[key];
		  if (/^(yes|on|true|enabled)$/i.test(val)) val = true;
		  else if (/^(no|off|false|disabled)$/i.test(val)) val = false;
		  else if (val === 'null') val = null;
		  else val = Number(val);

		  obj[prop] = val;
		  return obj;
		}, {});

		/**
		 * The file descriptor to write the `debug()` calls to.
		 * Set the `DEBUG_FD` env variable to override with another value. i.e.:
		 *
		 *   $ DEBUG_FD=3 node script.js 3>debug.log
		 */

		var fd = parseInt(process.env.DEBUG_FD, 10) || 2;

		if (1 !== fd && 2 !== fd) {
		  util.deprecate(function(){}, 'except for stderr(2) and stdout(1), any other usage of DEBUG_FD is deprecated. Override debug.log if you want to use a different log function (https://git.io/debug_fd)')();
		}

		var stream = 1 === fd ? process.stdout :
		             2 === fd ? process.stderr :
		             createWritableStdioStream(fd);

		/**
		 * Is stdout a TTY? Colored output is enabled when `true`.
		 */

		function useColors() {
		  return 'colors' in exports.inspectOpts
		    ? Boolean(exports.inspectOpts.colors)
		    : tty.isatty(fd);
		}

		/**
		 * Map %o to `util.inspect()`, all on a single line.
		 */

		exports.formatters.o = function(v) {
		  this.inspectOpts.colors = this.useColors;
		  return util.inspect(v, this.inspectOpts)
		    .split('\n').map(function(str) {
		      return str.trim()
		    }).join(' ');
		};

		/**
		 * Map %o to `util.inspect()`, allowing multiple lines if needed.
		 */

		exports.formatters.O = function(v) {
		  this.inspectOpts.colors = this.useColors;
		  return util.inspect(v, this.inspectOpts);
		};

		/**
		 * Adds ANSI color escape codes if enabled.
		 *
		 * @api public
		 */

		function formatArgs(args) {
		  var name = this.namespace;
		  var useColors = this.useColors;

		  if (useColors) {
		    var c = this.color;
		    var prefix = '  \u001b[3' + c + ';1m' + name + ' ' + '\u001b[0m';

		    args[0] = prefix + args[0].split('\n').join('\n' + prefix);
		    args.push('\u001b[3' + c + 'm+' + exports.humanize(this.diff) + '\u001b[0m');
		  } else {
		    args[0] = new Date().toUTCString()
		      + ' ' + name + ' ' + args[0];
		  }
		}

		/**
		 * Invokes `util.format()` with the specified arguments and writes to `stream`.
		 */

		function log() {
		  return stream.write(util.format.apply(util, arguments) + '\n');
		}

		/**
		 * Save `namespaces`.
		 *
		 * @param {String} namespaces
		 * @api private
		 */

		function save(namespaces) {
		  if (null == namespaces) {
		    // If you set a process.env field to null or undefined, it gets cast to the
		    // string 'null' or 'undefined'. Just delete instead.
		    delete process.env.DEBUG;
		  } else {
		    process.env.DEBUG = namespaces;
		  }
		}

		/**
		 * Load `namespaces`.
		 *
		 * @return {String} returns the previously persisted debug modes
		 * @api private
		 */

		function load() {
		  return process.env.DEBUG;
		}

		/**
		 * Copied from `node/src/node.js`.
		 *
		 * XXX: It's lame that node doesn't expose this API out-of-the-box. It also
		 * relies on the undocumented `tty_wrap.guessHandleType()` which is also lame.
		 */

		function createWritableStdioStream (fd) {
		  var stream;
		  var tty_wrap = process.binding('tty_wrap');

		  // Note stream._type is used for test-module-load-list.js

		  switch (tty_wrap.guessHandleType(fd)) {
		    case 'TTY':
		      stream = new tty.WriteStream(fd);
		      stream._type = 'tty';

		      // Hack to have stream not keep the event loop alive.
		      // See https://github.com/joyent/node/issues/1726
		      if (stream._handle && stream._handle.unref) {
		        stream._handle.unref();
		      }
		      break;

		    case 'FILE':
		      var fs = require$$3$1;
		      stream = new fs.SyncWriteStream(fd, { autoClose: false });
		      stream._type = 'fs';
		      break;

		    case 'PIPE':
		    case 'TCP':
		      var net = require$$4$2;
		      stream = new net.Socket({
		        fd: fd,
		        readable: false,
		        writable: true
		      });

		      // FIXME Should probably have an option in net.Socket to create a
		      // stream from an existing fd which is writable only. But for now
		      // we'll just add this hack and set the `readable` member to false.
		      // Test: ./node test/fixtures/echo.js < /etc/passwd
		      stream.readable = false;
		      stream.read = null;
		      stream._type = 'pipe';

		      // FIXME Hack to have stream not keep the event loop alive.
		      // See https://github.com/joyent/node/issues/1726
		      if (stream._handle && stream._handle.unref) {
		        stream._handle.unref();
		      }
		      break;

		    default:
		      // Probably an error on in uv_guess_handle()
		      throw new Error('Implement me. Unknown stream file type!');
		  }

		  // For supporting legacy API we put the FD here.
		  stream.fd = fd;

		  stream._isStdio = true;

		  return stream;
		}

		/**
		 * Init logic for `debug` instances.
		 *
		 * Create a new `inspectOpts` object in case `useColors` is set
		 * differently for a particular `debug` instance.
		 */

		function init (debug) {
		  debug.inspectOpts = {};

		  var keys = Object.keys(exports.inspectOpts);
		  for (var i = 0; i < keys.length; i++) {
		    debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
		  }
		}

		/**
		 * Enable namespaces listed in `process.env.DEBUG` initially.
		 */

		exports.enable(load()); 
	} (node, node.exports));
	return node.exports;
}

var hasRequiredSrc;

function requireSrc () {
	if (hasRequiredSrc) return src.exports;
	hasRequiredSrc = 1;
	if (typeof process !== 'undefined' && process.type === 'renderer') {
	  src.exports = requireBrowser();
	} else {
	  src.exports = requireNode();
	}
	return src.exports;
}

var destroy_1;
var hasRequiredDestroy;

function requireDestroy () {
	if (hasRequiredDestroy) return destroy_1;
	hasRequiredDestroy = 1;

	var EventEmitter = require$$0$7.EventEmitter;
	var ReadStream = require$$3$1.ReadStream;
	var Stream = require$$1$2;
	var Zlib = require$$3$2;

	destroy_1 = destroy;

	function destroy (stream, suppress) {
	  if (isFsReadStream(stream)) {
	    destroyReadStream(stream);
	  } else if (isZlibStream(stream)) {
	    destroyZlibStream(stream);
	  } else if (hasDestroy(stream)) {
	    stream.destroy();
	  }

	  if (isEventEmitter(stream) && suppress) {
	    stream.removeAllListeners('error');
	    stream.addListener('error', noop);
	  }

	  return stream
	}

	function destroyReadStream (stream) {
	  stream.destroy();

	  if (typeof stream.close === 'function') {
	    // node.js core bug work-around
	    stream.on('open', onOpenClose);
	  }
	}

	function closeZlibStream (stream) {
	  if (stream._hadError === true) {
	    var prop = stream._binding === null
	      ? '_binding'
	      : '_handle';

	    stream[prop] = {
	      close: function () { this[prop] = null; }
	    };
	  }

	  stream.close();
	}

	function destroyZlibStream (stream) {
	  if (typeof stream.destroy === 'function') {
	    // node.js core bug work-around
	    // istanbul ignore if: node.js 0.8
	    if (stream._binding) {
	      // node.js < 0.10.0
	      stream.destroy();
	      if (stream._processing) {
	        stream._needDrain = true;
	        stream.once('drain', onDrainClearBinding);
	      } else {
	        stream._binding.clear();
	      }
	    } else if (stream._destroy && stream._destroy !== Stream.Transform.prototype._destroy) {
	      // node.js >= 12, ^11.1.0, ^10.15.1
	      stream.destroy();
	    } else if (stream._destroy && typeof stream.close === 'function') {
	      // node.js 7, 8
	      stream.destroyed = true;
	      stream.close();
	    } else {
	      // fallback
	      // istanbul ignore next
	      stream.destroy();
	    }
	  } else if (typeof stream.close === 'function') {
	    // node.js < 8 fallback
	    closeZlibStream(stream);
	  }
	}

	function hasDestroy (stream) {
	  return stream instanceof Stream &&
	    typeof stream.destroy === 'function'
	}


	function isEventEmitter (val) {
	  return val instanceof EventEmitter
	}


	function isFsReadStream (stream) {
	  return stream instanceof ReadStream
	}


	function isZlibStream (stream) {
	  return stream instanceof Zlib.Gzip ||
	    stream instanceof Zlib.Gunzip ||
	    stream instanceof Zlib.Deflate ||
	    stream instanceof Zlib.DeflateRaw ||
	    stream instanceof Zlib.Inflate ||
	    stream instanceof Zlib.InflateRaw ||
	    stream instanceof Zlib.Unzip
	}

	function noop () {}

	// istanbul ignore next: node.js 0.8
	function onDrainClearBinding () {
	  this._binding.clear();
	}

	function onOpenClose () {
	  if (typeof this.fd === 'number') {
	    // actually close down the fd
	    this.close();
	  }
	}
	return destroy_1;
}

var lib$2 = {exports: {}};

/* eslint-disable node/no-deprecated-api */

var safer_1;
var hasRequiredSafer;

function requireSafer () {
	if (hasRequiredSafer) return safer_1;
	hasRequiredSafer = 1;

	var buffer = require$$0$8;
	var Buffer = buffer.Buffer;

	var safer = {};

	var key;

	for (key in buffer) {
	  if (!buffer.hasOwnProperty(key)) continue
	  if (key === 'SlowBuffer' || key === 'Buffer') continue
	  safer[key] = buffer[key];
	}

	var Safer = safer.Buffer = {};
	for (key in Buffer) {
	  if (!Buffer.hasOwnProperty(key)) continue
	  if (key === 'allocUnsafe' || key === 'allocUnsafeSlow') continue
	  Safer[key] = Buffer[key];
	}

	safer.Buffer.prototype = Buffer.prototype;

	if (!Safer.from || Safer.from === Uint8Array.from) {
	  Safer.from = function (value, encodingOrOffset, length) {
	    if (typeof value === 'number') {
	      throw new TypeError('The "value" argument must not be of type number. Received type ' + typeof value)
	    }
	    if (value && typeof value.length === 'undefined') {
	      throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type ' + typeof value)
	    }
	    return Buffer(value, encodingOrOffset, length)
	  };
	}

	if (!Safer.alloc) {
	  Safer.alloc = function (size, fill, encoding) {
	    if (typeof size !== 'number') {
	      throw new TypeError('The "size" argument must be of type number. Received type ' + typeof size)
	    }
	    if (size < 0 || size >= 2 * (1 << 30)) {
	      throw new RangeError('The value "' + size + '" is invalid for option "size"')
	    }
	    var buf = Buffer(size);
	    if (!fill || fill.length === 0) {
	      buf.fill(0);
	    } else if (typeof encoding === 'string') {
	      buf.fill(fill, encoding);
	    } else {
	      buf.fill(fill);
	    }
	    return buf
	  };
	}

	if (!safer.kStringMaxLength) {
	  try {
	    safer.kStringMaxLength = process.binding('buffer').kStringMaxLength;
	  } catch (e) {
	    // we can't determine kStringMaxLength in environments where process.binding
	    // is unsupported, so let's not set it
	  }
	}

	if (!safer.constants) {
	  safer.constants = {
	    MAX_LENGTH: safer.kMaxLength
	  };
	  if (safer.kStringMaxLength) {
	    safer.constants.MAX_STRING_LENGTH = safer.kStringMaxLength;
	  }
	}

	safer_1 = safer;
	return safer_1;
}

var bomHandling = {};

var hasRequiredBomHandling;

function requireBomHandling () {
	if (hasRequiredBomHandling) return bomHandling;
	hasRequiredBomHandling = 1;

	var BOMChar = '\uFEFF';

	bomHandling.PrependBOM = PrependBOMWrapper;
	function PrependBOMWrapper(encoder, options) {
	    this.encoder = encoder;
	    this.addBOM = true;
	}

	PrependBOMWrapper.prototype.write = function(str) {
	    if (this.addBOM) {
	        str = BOMChar + str;
	        this.addBOM = false;
	    }

	    return this.encoder.write(str);
	};

	PrependBOMWrapper.prototype.end = function() {
	    return this.encoder.end();
	};


	//------------------------------------------------------------------------------

	bomHandling.StripBOM = StripBOMWrapper;
	function StripBOMWrapper(decoder, options) {
	    this.decoder = decoder;
	    this.pass = false;
	    this.options = options || {};
	}

	StripBOMWrapper.prototype.write = function(buf) {
	    var res = this.decoder.write(buf);
	    if (this.pass || !res)
	        return res;

	    if (res[0] === BOMChar) {
	        res = res.slice(1);
	        if (typeof this.options.stripBOM === 'function')
	            this.options.stripBOM();
	    }

	    this.pass = true;
	    return res;
	};

	StripBOMWrapper.prototype.end = function() {
	    return this.decoder.end();
	};
	return bomHandling;
}

var encodings = {};

var internal;
var hasRequiredInternal;

function requireInternal () {
	if (hasRequiredInternal) return internal;
	hasRequiredInternal = 1;
	var Buffer = requireSafer().Buffer;

	internal = {
	    // Encodings
	    utf8:   { type: "_internal", bomAware: true},
	    cesu8:  { type: "_internal", bomAware: true},
	    unicode11utf8: "utf8",

	    ucs2:   { type: "_internal", bomAware: true},
	    utf16le: "ucs2",

	    binary: { type: "_internal" },
	    base64: { type: "_internal" },
	    hex:    { type: "_internal" },

	    // Codec.
	    _internal: InternalCodec,
	};
	function InternalCodec(codecOptions, iconv) {
	    this.enc = codecOptions.encodingName;
	    this.bomAware = codecOptions.bomAware;

	    if (this.enc === "base64")
	        this.encoder = InternalEncoderBase64;
	    else if (this.enc === "cesu8") {
	        this.enc = "utf8"; // Use utf8 for decoding.
	        this.encoder = InternalEncoderCesu8;

	        // Add decoder for versions of Node not supporting CESU-8
	        if (Buffer.from('eda0bdedb2a9', 'hex').toString() !== '💩') {
	            this.decoder = InternalDecoderCesu8;
	            this.defaultCharUnicode = iconv.defaultCharUnicode;
	        }
	    }
	}

	InternalCodec.prototype.encoder = InternalEncoder;
	InternalCodec.prototype.decoder = InternalDecoder;

	var StringDecoder = require$$1$4.StringDecoder;

	if (!StringDecoder.prototype.end) // Node v0.8 doesn't have this method.
	    StringDecoder.prototype.end = function() {};


	function InternalDecoder(options, codec) {
	    StringDecoder.call(this, codec.enc);
	}

	InternalDecoder.prototype = StringDecoder.prototype;

	function InternalEncoder(options, codec) {
	    this.enc = codec.enc;
	}

	InternalEncoder.prototype.write = function(str) {
	    return Buffer.from(str, this.enc);
	};

	InternalEncoder.prototype.end = function() {
	};

	function InternalEncoderBase64(options, codec) {
	    this.prevStr = '';
	}

	InternalEncoderBase64.prototype.write = function(str) {
	    str = this.prevStr + str;
	    var completeQuads = str.length - (str.length % 4);
	    this.prevStr = str.slice(completeQuads);
	    str = str.slice(0, completeQuads);

	    return Buffer.from(str, "base64");
	};

	InternalEncoderBase64.prototype.end = function() {
	    return Buffer.from(this.prevStr, "base64");
	};

	function InternalEncoderCesu8(options, codec) {
	}

	InternalEncoderCesu8.prototype.write = function(str) {
	    var buf = Buffer.alloc(str.length * 3), bufIdx = 0;
	    for (var i = 0; i < str.length; i++) {
	        var charCode = str.charCodeAt(i);
	        // Naive implementation, but it works because CESU-8 is especially easy
	        // to convert from UTF-16 (which all JS strings are encoded in).
	        if (charCode < 0x80)
	            buf[bufIdx++] = charCode;
	        else if (charCode < 0x800) {
	            buf[bufIdx++] = 0xC0 + (charCode >>> 6);
	            buf[bufIdx++] = 0x80 + (charCode & 0x3f);
	        }
	        else { // charCode will always be < 0x10000 in javascript.
	            buf[bufIdx++] = 0xE0 + (charCode >>> 12);
	            buf[bufIdx++] = 0x80 + ((charCode >>> 6) & 0x3f);
	            buf[bufIdx++] = 0x80 + (charCode & 0x3f);
	        }
	    }
	    return buf.slice(0, bufIdx);
	};

	InternalEncoderCesu8.prototype.end = function() {
	};

	//------------------------------------------------------------------------------
	// CESU-8 decoder is not implemented in Node v4.0+

	function InternalDecoderCesu8(options, codec) {
	    this.acc = 0;
	    this.contBytes = 0;
	    this.accBytes = 0;
	    this.defaultCharUnicode = codec.defaultCharUnicode;
	}

	InternalDecoderCesu8.prototype.write = function(buf) {
	    var acc = this.acc, contBytes = this.contBytes, accBytes = this.accBytes, 
	        res = '';
	    for (var i = 0; i < buf.length; i++) {
	        var curByte = buf[i];
	        if ((curByte & 0xC0) !== 0x80) { // Leading byte
	            if (contBytes > 0) { // Previous code is invalid
	                res += this.defaultCharUnicode;
	                contBytes = 0;
	            }

	            if (curByte < 0x80) { // Single-byte code
	                res += String.fromCharCode(curByte);
	            } else if (curByte < 0xE0) { // Two-byte code
	                acc = curByte & 0x1F;
	                contBytes = 1; accBytes = 1;
	            } else if (curByte < 0xF0) { // Three-byte code
	                acc = curByte & 0x0F;
	                contBytes = 2; accBytes = 1;
	            } else { // Four or more are not supported for CESU-8.
	                res += this.defaultCharUnicode;
	            }
	        } else { // Continuation byte
	            if (contBytes > 0) { // We're waiting for it.
	                acc = (acc << 6) | (curByte & 0x3f);
	                contBytes--; accBytes++;
	                if (contBytes === 0) {
	                    // Check for overlong encoding, but support Modified UTF-8 (encoding NULL as C0 80)
	                    if (accBytes === 2 && acc < 0x80 && acc > 0)
	                        res += this.defaultCharUnicode;
	                    else if (accBytes === 3 && acc < 0x800)
	                        res += this.defaultCharUnicode;
	                    else
	                        // Actually add character.
	                        res += String.fromCharCode(acc);
	                }
	            } else { // Unexpected continuation byte
	                res += this.defaultCharUnicode;
	            }
	        }
	    }
	    this.acc = acc; this.contBytes = contBytes; this.accBytes = accBytes;
	    return res;
	};

	InternalDecoderCesu8.prototype.end = function() {
	    var res = 0;
	    if (this.contBytes > 0)
	        res += this.defaultCharUnicode;
	    return res;
	};
	return internal;
}

var utf16 = {};

var hasRequiredUtf16;

function requireUtf16 () {
	if (hasRequiredUtf16) return utf16;
	hasRequiredUtf16 = 1;
	var Buffer = requireSafer().Buffer;

	utf16.utf16be = Utf16BECodec;
	function Utf16BECodec() {
	}

	Utf16BECodec.prototype.encoder = Utf16BEEncoder;
	Utf16BECodec.prototype.decoder = Utf16BEDecoder;
	Utf16BECodec.prototype.bomAware = true;


	// -- Encoding

	function Utf16BEEncoder() {
	}

	Utf16BEEncoder.prototype.write = function(str) {
	    var buf = Buffer.from(str, 'ucs2');
	    for (var i = 0; i < buf.length; i += 2) {
	        var tmp = buf[i]; buf[i] = buf[i+1]; buf[i+1] = tmp;
	    }
	    return buf;
	};

	Utf16BEEncoder.prototype.end = function() {
	};


	// -- Decoding

	function Utf16BEDecoder() {
	    this.overflowByte = -1;
	}

	Utf16BEDecoder.prototype.write = function(buf) {
	    if (buf.length == 0)
	        return '';

	    var buf2 = Buffer.alloc(buf.length + 1),
	        i = 0, j = 0;

	    if (this.overflowByte !== -1) {
	        buf2[0] = buf[0];
	        buf2[1] = this.overflowByte;
	        i = 1; j = 2;
	    }

	    for (; i < buf.length-1; i += 2, j+= 2) {
	        buf2[j] = buf[i+1];
	        buf2[j+1] = buf[i];
	    }

	    this.overflowByte = (i == buf.length-1) ? buf[buf.length-1] : -1;

	    return buf2.slice(0, j).toString('ucs2');
	};

	Utf16BEDecoder.prototype.end = function() {
	};


	// == UTF-16 codec =============================================================
	// Decoder chooses automatically from UTF-16LE and UTF-16BE using BOM and space-based heuristic.
	// Defaults to UTF-16LE, as it's prevalent and default in Node.
	// http://en.wikipedia.org/wiki/UTF-16 and http://encoding.spec.whatwg.org/#utf-16le
	// Decoder default can be changed: iconv.decode(buf, 'utf16', {defaultEncoding: 'utf-16be'});

	// Encoder uses UTF-16LE and prepends BOM (which can be overridden with addBOM: false).

	utf16.utf16 = Utf16Codec;
	function Utf16Codec(codecOptions, iconv) {
	    this.iconv = iconv;
	}

	Utf16Codec.prototype.encoder = Utf16Encoder;
	Utf16Codec.prototype.decoder = Utf16Decoder;


	// -- Encoding (pass-through)

	function Utf16Encoder(options, codec) {
	    options = options || {};
	    if (options.addBOM === undefined)
	        options.addBOM = true;
	    this.encoder = codec.iconv.getEncoder('utf-16le', options);
	}

	Utf16Encoder.prototype.write = function(str) {
	    return this.encoder.write(str);
	};

	Utf16Encoder.prototype.end = function() {
	    return this.encoder.end();
	};


	// -- Decoding

	function Utf16Decoder(options, codec) {
	    this.decoder = null;
	    this.initialBytes = [];
	    this.initialBytesLen = 0;

	    this.options = options || {};
	    this.iconv = codec.iconv;
	}

	Utf16Decoder.prototype.write = function(buf) {
	    if (!this.decoder) {
	        // Codec is not chosen yet. Accumulate initial bytes.
	        this.initialBytes.push(buf);
	        this.initialBytesLen += buf.length;
	        
	        if (this.initialBytesLen < 16) // We need more bytes to use space heuristic (see below)
	            return '';

	        // We have enough bytes -> detect endianness.
	        var buf = Buffer.concat(this.initialBytes),
	            encoding = detectEncoding(buf, this.options.defaultEncoding);
	        this.decoder = this.iconv.getDecoder(encoding, this.options);
	        this.initialBytes.length = this.initialBytesLen = 0;
	    }

	    return this.decoder.write(buf);
	};

	Utf16Decoder.prototype.end = function() {
	    if (!this.decoder) {
	        var buf = Buffer.concat(this.initialBytes),
	            encoding = detectEncoding(buf, this.options.defaultEncoding);
	        this.decoder = this.iconv.getDecoder(encoding, this.options);

	        var res = this.decoder.write(buf),
	            trail = this.decoder.end();

	        return trail ? (res + trail) : res;
	    }
	    return this.decoder.end();
	};

	function detectEncoding(buf, defaultEncoding) {
	    var enc = defaultEncoding || 'utf-16le';

	    if (buf.length >= 2) {
	        // Check BOM.
	        if (buf[0] == 0xFE && buf[1] == 0xFF) // UTF-16BE BOM
	            enc = 'utf-16be';
	        else if (buf[0] == 0xFF && buf[1] == 0xFE) // UTF-16LE BOM
	            enc = 'utf-16le';
	        else {
	            // No BOM found. Try to deduce encoding from initial content.
	            // Most of the time, the content has ASCII chars (U+00**), but the opposite (U+**00) is uncommon.
	            // So, we count ASCII as if it was LE or BE, and decide from that.
	            var asciiCharsLE = 0, asciiCharsBE = 0, // Counts of chars in both positions
	                _len = Math.min(buf.length - (buf.length % 2), 64); // Len is always even.

	            for (var i = 0; i < _len; i += 2) {
	                if (buf[i] === 0 && buf[i+1] !== 0) asciiCharsBE++;
	                if (buf[i] !== 0 && buf[i+1] === 0) asciiCharsLE++;
	            }

	            if (asciiCharsBE > asciiCharsLE)
	                enc = 'utf-16be';
	            else if (asciiCharsBE < asciiCharsLE)
	                enc = 'utf-16le';
	        }
	    }

	    return enc;
	}
	return utf16;
}

var utf7 = {};

var hasRequiredUtf7;

function requireUtf7 () {
	if (hasRequiredUtf7) return utf7;
	hasRequiredUtf7 = 1;
	var Buffer = requireSafer().Buffer;

	// UTF-7 codec, according to https://tools.ietf.org/html/rfc2152
	// See also below a UTF-7-IMAP codec, according to http://tools.ietf.org/html/rfc3501#section-5.1.3

	utf7.utf7 = Utf7Codec;
	utf7.unicode11utf7 = 'utf7'; // Alias UNICODE-1-1-UTF-7
	function Utf7Codec(codecOptions, iconv) {
	    this.iconv = iconv;
	}
	Utf7Codec.prototype.encoder = Utf7Encoder;
	Utf7Codec.prototype.decoder = Utf7Decoder;
	Utf7Codec.prototype.bomAware = true;


	// -- Encoding

	var nonDirectChars = /[^A-Za-z0-9'\(\),-\.\/:\? \n\r\t]+/g;

	function Utf7Encoder(options, codec) {
	    this.iconv = codec.iconv;
	}

	Utf7Encoder.prototype.write = function(str) {
	    // Naive implementation.
	    // Non-direct chars are encoded as "+<base64>-"; single "+" char is encoded as "+-".
	    return Buffer.from(str.replace(nonDirectChars, function(chunk) {
	        return "+" + (chunk === '+' ? '' : 
	            this.iconv.encode(chunk, 'utf16-be').toString('base64').replace(/=+$/, '')) 
	            + "-";
	    }.bind(this)));
	};

	Utf7Encoder.prototype.end = function() {
	};

	function Utf7Decoder(options, codec) {
	    this.iconv = codec.iconv;
	    this.inBase64 = false;
	    this.base64Accum = '';
	}

	var base64Regex = /[A-Za-z0-9\/+]/;
	var base64Chars = [];
	for (var i = 0; i < 256; i++)
	    base64Chars[i] = base64Regex.test(String.fromCharCode(i));

	var plusChar = '+'.charCodeAt(0), 
	    minusChar = '-'.charCodeAt(0),
	    andChar = '&'.charCodeAt(0);

	Utf7Decoder.prototype.write = function(buf) {
	    var res = "", lastI = 0,
	        inBase64 = this.inBase64,
	        base64Accum = this.base64Accum;

	    // The decoder is more involved as we must handle chunks in stream.

	    for (var i = 0; i < buf.length; i++) {
	        if (!inBase64) { // We're in direct mode.
	            // Write direct chars until '+'
	            if (buf[i] == plusChar) {
	                res += this.iconv.decode(buf.slice(lastI, i), "ascii"); // Write direct chars.
	                lastI = i+1;
	                inBase64 = true;
	            }
	        } else { // We decode base64.
	            if (!base64Chars[buf[i]]) { // Base64 ended.
	                if (i == lastI && buf[i] == minusChar) {// "+-" -> "+"
	                    res += "+";
	                } else {
	                    var b64str = base64Accum + buf.slice(lastI, i).toString();
	                    res += this.iconv.decode(Buffer.from(b64str, 'base64'), "utf16-be");
	                }

	                if (buf[i] != minusChar) // Minus is absorbed after base64.
	                    i--;

	                lastI = i+1;
	                inBase64 = false;
	                base64Accum = '';
	            }
	        }
	    }

	    if (!inBase64) {
	        res += this.iconv.decode(buf.slice(lastI), "ascii"); // Write direct chars.
	    } else {
	        var b64str = base64Accum + buf.slice(lastI).toString();

	        var canBeDecoded = b64str.length - (b64str.length % 8); // Minimal chunk: 2 quads -> 2x3 bytes -> 3 chars.
	        base64Accum = b64str.slice(canBeDecoded); // The rest will be decoded in future.
	        b64str = b64str.slice(0, canBeDecoded);

	        res += this.iconv.decode(Buffer.from(b64str, 'base64'), "utf16-be");
	    }

	    this.inBase64 = inBase64;
	    this.base64Accum = base64Accum;

	    return res;
	};

	Utf7Decoder.prototype.end = function() {
	    var res = "";
	    if (this.inBase64 && this.base64Accum.length > 0)
	        res = this.iconv.decode(Buffer.from(this.base64Accum, 'base64'), "utf16-be");

	    this.inBase64 = false;
	    this.base64Accum = '';
	    return res;
	};


	utf7.utf7imap = Utf7IMAPCodec;
	function Utf7IMAPCodec(codecOptions, iconv) {
	    this.iconv = iconv;
	}
	Utf7IMAPCodec.prototype.encoder = Utf7IMAPEncoder;
	Utf7IMAPCodec.prototype.decoder = Utf7IMAPDecoder;
	Utf7IMAPCodec.prototype.bomAware = true;


	// -- Encoding

	function Utf7IMAPEncoder(options, codec) {
	    this.iconv = codec.iconv;
	    this.inBase64 = false;
	    this.base64Accum = Buffer.alloc(6);
	    this.base64AccumIdx = 0;
	}

	Utf7IMAPEncoder.prototype.write = function(str) {
	    var inBase64 = this.inBase64,
	        base64Accum = this.base64Accum,
	        base64AccumIdx = this.base64AccumIdx,
	        buf = Buffer.alloc(str.length*5 + 10), bufIdx = 0;

	    for (var i = 0; i < str.length; i++) {
	        var uChar = str.charCodeAt(i);
	        if (0x20 <= uChar && uChar <= 0x7E) { // Direct character or '&'.
	            if (inBase64) {
	                if (base64AccumIdx > 0) {
	                    bufIdx += buf.write(base64Accum.slice(0, base64AccumIdx).toString('base64').replace(/\//g, ',').replace(/=+$/, ''), bufIdx);
	                    base64AccumIdx = 0;
	                }

	                buf[bufIdx++] = minusChar; // Write '-', then go to direct mode.
	                inBase64 = false;
	            }

	            if (!inBase64) {
	                buf[bufIdx++] = uChar; // Write direct character

	                if (uChar === andChar)  // Ampersand -> '&-'
	                    buf[bufIdx++] = minusChar;
	            }

	        } else { // Non-direct character
	            if (!inBase64) {
	                buf[bufIdx++] = andChar; // Write '&', then go to base64 mode.
	                inBase64 = true;
	            }
	            if (inBase64) {
	                base64Accum[base64AccumIdx++] = uChar >> 8;
	                base64Accum[base64AccumIdx++] = uChar & 0xFF;

	                if (base64AccumIdx == base64Accum.length) {
	                    bufIdx += buf.write(base64Accum.toString('base64').replace(/\//g, ','), bufIdx);
	                    base64AccumIdx = 0;
	                }
	            }
	        }
	    }

	    this.inBase64 = inBase64;
	    this.base64AccumIdx = base64AccumIdx;

	    return buf.slice(0, bufIdx);
	};

	Utf7IMAPEncoder.prototype.end = function() {
	    var buf = Buffer.alloc(10), bufIdx = 0;
	    if (this.inBase64) {
	        if (this.base64AccumIdx > 0) {
	            bufIdx += buf.write(this.base64Accum.slice(0, this.base64AccumIdx).toString('base64').replace(/\//g, ',').replace(/=+$/, ''), bufIdx);
	            this.base64AccumIdx = 0;
	        }

	        buf[bufIdx++] = minusChar; // Write '-', then go to direct mode.
	        this.inBase64 = false;
	    }

	    return buf.slice(0, bufIdx);
	};


	// -- Decoding

	function Utf7IMAPDecoder(options, codec) {
	    this.iconv = codec.iconv;
	    this.inBase64 = false;
	    this.base64Accum = '';
	}

	var base64IMAPChars = base64Chars.slice();
	base64IMAPChars[','.charCodeAt(0)] = true;

	Utf7IMAPDecoder.prototype.write = function(buf) {
	    var res = "", lastI = 0,
	        inBase64 = this.inBase64,
	        base64Accum = this.base64Accum;

	    // The decoder is more involved as we must handle chunks in stream.
	    // It is forgiving, closer to standard UTF-7 (for example, '-' is optional at the end).

	    for (var i = 0; i < buf.length; i++) {
	        if (!inBase64) { // We're in direct mode.
	            // Write direct chars until '&'
	            if (buf[i] == andChar) {
	                res += this.iconv.decode(buf.slice(lastI, i), "ascii"); // Write direct chars.
	                lastI = i+1;
	                inBase64 = true;
	            }
	        } else { // We decode base64.
	            if (!base64IMAPChars[buf[i]]) { // Base64 ended.
	                if (i == lastI && buf[i] == minusChar) { // "&-" -> "&"
	                    res += "&";
	                } else {
	                    var b64str = base64Accum + buf.slice(lastI, i).toString().replace(/,/g, '/');
	                    res += this.iconv.decode(Buffer.from(b64str, 'base64'), "utf16-be");
	                }

	                if (buf[i] != minusChar) // Minus may be absorbed after base64.
	                    i--;

	                lastI = i+1;
	                inBase64 = false;
	                base64Accum = '';
	            }
	        }
	    }

	    if (!inBase64) {
	        res += this.iconv.decode(buf.slice(lastI), "ascii"); // Write direct chars.
	    } else {
	        var b64str = base64Accum + buf.slice(lastI).toString().replace(/,/g, '/');

	        var canBeDecoded = b64str.length - (b64str.length % 8); // Minimal chunk: 2 quads -> 2x3 bytes -> 3 chars.
	        base64Accum = b64str.slice(canBeDecoded); // The rest will be decoded in future.
	        b64str = b64str.slice(0, canBeDecoded);

	        res += this.iconv.decode(Buffer.from(b64str, 'base64'), "utf16-be");
	    }

	    this.inBase64 = inBase64;
	    this.base64Accum = base64Accum;

	    return res;
	};

	Utf7IMAPDecoder.prototype.end = function() {
	    var res = "";
	    if (this.inBase64 && this.base64Accum.length > 0)
	        res = this.iconv.decode(Buffer.from(this.base64Accum, 'base64'), "utf16-be");

	    this.inBase64 = false;
	    this.base64Accum = '';
	    return res;
	};
	return utf7;
}

var sbcsCodec = {};

var hasRequiredSbcsCodec;

function requireSbcsCodec () {
	if (hasRequiredSbcsCodec) return sbcsCodec;
	hasRequiredSbcsCodec = 1;
	var Buffer = requireSafer().Buffer;

	sbcsCodec._sbcs = SBCSCodec;
	function SBCSCodec(codecOptions, iconv) {
	    if (!codecOptions)
	        throw new Error("SBCS codec is called without the data.")
	    
	    // Prepare char buffer for decoding.
	    if (!codecOptions.chars || (codecOptions.chars.length !== 128 && codecOptions.chars.length !== 256))
	        throw new Error("Encoding '"+codecOptions.type+"' has incorrect 'chars' (must be of len 128 or 256)");
	    
	    if (codecOptions.chars.length === 128) {
	        var asciiString = "";
	        for (var i = 0; i < 128; i++)
	            asciiString += String.fromCharCode(i);
	        codecOptions.chars = asciiString + codecOptions.chars;
	    }

	    this.decodeBuf = Buffer.from(codecOptions.chars, 'ucs2');
	    
	    // Encoding buffer.
	    var encodeBuf = Buffer.alloc(65536, iconv.defaultCharSingleByte.charCodeAt(0));

	    for (var i = 0; i < codecOptions.chars.length; i++)
	        encodeBuf[codecOptions.chars.charCodeAt(i)] = i;

	    this.encodeBuf = encodeBuf;
	}

	SBCSCodec.prototype.encoder = SBCSEncoder;
	SBCSCodec.prototype.decoder = SBCSDecoder;


	function SBCSEncoder(options, codec) {
	    this.encodeBuf = codec.encodeBuf;
	}

	SBCSEncoder.prototype.write = function(str) {
	    var buf = Buffer.alloc(str.length);
	    for (var i = 0; i < str.length; i++)
	        buf[i] = this.encodeBuf[str.charCodeAt(i)];
	    
	    return buf;
	};

	SBCSEncoder.prototype.end = function() {
	};


	function SBCSDecoder(options, codec) {
	    this.decodeBuf = codec.decodeBuf;
	}

	SBCSDecoder.prototype.write = function(buf) {
	    // Strings are immutable in JS -> we use ucs2 buffer to speed up computations.
	    var decodeBuf = this.decodeBuf;
	    var newBuf = Buffer.alloc(buf.length*2);
	    var idx1 = 0, idx2 = 0;
	    for (var i = 0; i < buf.length; i++) {
	        idx1 = buf[i]*2; idx2 = i*2;
	        newBuf[idx2] = decodeBuf[idx1];
	        newBuf[idx2+1] = decodeBuf[idx1+1];
	    }
	    return newBuf.toString('ucs2');
	};

	SBCSDecoder.prototype.end = function() {
	};
	return sbcsCodec;
}

var sbcsData;
var hasRequiredSbcsData;

function requireSbcsData () {
	if (hasRequiredSbcsData) return sbcsData;
	hasRequiredSbcsData = 1;

	// Manually added data to be used by sbcs codec in addition to generated one.

	sbcsData = {
	    // Not supported by iconv, not sure why.
	    "10029": "maccenteuro",
	    "maccenteuro": {
	        "type": "_sbcs",
	        "chars": "ÄĀāÉĄÖÜáąČäčĆćéŹźĎíďĒēĖóėôöõúĚěü†°Ę£§•¶ß®©™ę¨≠ģĮįĪ≤≥īĶ∂∑łĻļĽľĹĺŅņŃ¬√ńŇ∆«»… ňŐÕőŌ–—“”‘’÷◊ōŔŕŘ‹›řŖŗŠ‚„šŚśÁŤťÍŽžŪÓÔūŮÚůŰűŲųÝýķŻŁżĢˇ"
	    },

	    "808": "cp808",
	    "ibm808": "cp808",
	    "cp808": {
	        "type": "_sbcs",
	        "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№€■ "
	    },

	    "mik": {
	        "type": "_sbcs",
	        "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя└┴┬├─┼╣║╚╔╩╦╠═╬┐░▒▓│┤№§╗╝┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
	    },

	    // Aliases of generated encodings.
	    "ascii8bit": "ascii",
	    "usascii": "ascii",
	    "ansix34": "ascii",
	    "ansix341968": "ascii",
	    "ansix341986": "ascii",
	    "csascii": "ascii",
	    "cp367": "ascii",
	    "ibm367": "ascii",
	    "isoir6": "ascii",
	    "iso646us": "ascii",
	    "iso646irv": "ascii",
	    "us": "ascii",

	    "latin1": "iso88591",
	    "latin2": "iso88592",
	    "latin3": "iso88593",
	    "latin4": "iso88594",
	    "latin5": "iso88599",
	    "latin6": "iso885910",
	    "latin7": "iso885913",
	    "latin8": "iso885914",
	    "latin9": "iso885915",
	    "latin10": "iso885916",

	    "csisolatin1": "iso88591",
	    "csisolatin2": "iso88592",
	    "csisolatin3": "iso88593",
	    "csisolatin4": "iso88594",
	    "csisolatincyrillic": "iso88595",
	    "csisolatinarabic": "iso88596",
	    "csisolatingreek" : "iso88597",
	    "csisolatinhebrew": "iso88598",
	    "csisolatin5": "iso88599",
	    "csisolatin6": "iso885910",

	    "l1": "iso88591",
	    "l2": "iso88592",
	    "l3": "iso88593",
	    "l4": "iso88594",
	    "l5": "iso88599",
	    "l6": "iso885910",
	    "l7": "iso885913",
	    "l8": "iso885914",
	    "l9": "iso885915",
	    "l10": "iso885916",

	    "isoir14": "iso646jp",
	    "isoir57": "iso646cn",
	    "isoir100": "iso88591",
	    "isoir101": "iso88592",
	    "isoir109": "iso88593",
	    "isoir110": "iso88594",
	    "isoir144": "iso88595",
	    "isoir127": "iso88596",
	    "isoir126": "iso88597",
	    "isoir138": "iso88598",
	    "isoir148": "iso88599",
	    "isoir157": "iso885910",
	    "isoir166": "tis620",
	    "isoir179": "iso885913",
	    "isoir199": "iso885914",
	    "isoir203": "iso885915",
	    "isoir226": "iso885916",

	    "cp819": "iso88591",
	    "ibm819": "iso88591",

	    "cyrillic": "iso88595",

	    "arabic": "iso88596",
	    "arabic8": "iso88596",
	    "ecma114": "iso88596",
	    "asmo708": "iso88596",

	    "greek" : "iso88597",
	    "greek8" : "iso88597",
	    "ecma118" : "iso88597",
	    "elot928" : "iso88597",

	    "hebrew": "iso88598",
	    "hebrew8": "iso88598",

	    "turkish": "iso88599",
	    "turkish8": "iso88599",

	    "thai": "iso885911",
	    "thai8": "iso885911",

	    "celtic": "iso885914",
	    "celtic8": "iso885914",
	    "isoceltic": "iso885914",

	    "tis6200": "tis620",
	    "tis62025291": "tis620",
	    "tis62025330": "tis620",

	    "10000": "macroman",
	    "10006": "macgreek",
	    "10007": "maccyrillic",
	    "10079": "maciceland",
	    "10081": "macturkish",

	    "cspc8codepage437": "cp437",
	    "cspc775baltic": "cp775",
	    "cspc850multilingual": "cp850",
	    "cspcp852": "cp852",
	    "cspc862latinhebrew": "cp862",
	    "cpgr": "cp869",

	    "msee": "cp1250",
	    "mscyrl": "cp1251",
	    "msansi": "cp1252",
	    "msgreek": "cp1253",
	    "msturk": "cp1254",
	    "mshebr": "cp1255",
	    "msarab": "cp1256",
	    "winbaltrim": "cp1257",

	    "cp20866": "koi8r",
	    "20866": "koi8r",
	    "ibm878": "koi8r",
	    "cskoi8r": "koi8r",

	    "cp21866": "koi8u",
	    "21866": "koi8u",
	    "ibm1168": "koi8u",

	    "strk10482002": "rk1048",

	    "tcvn5712": "tcvn",
	    "tcvn57121": "tcvn",

	    "gb198880": "iso646cn",
	    "cn": "iso646cn",

	    "csiso14jisc6220ro": "iso646jp",
	    "jisc62201969ro": "iso646jp",
	    "jp": "iso646jp",

	    "cshproman8": "hproman8",
	    "r8": "hproman8",
	    "roman8": "hproman8",
	    "xroman8": "hproman8",
	    "ibm1051": "hproman8",

	    "mac": "macintosh",
	    "csmacintosh": "macintosh",
	};
	return sbcsData;
}

var sbcsDataGenerated;
var hasRequiredSbcsDataGenerated;

function requireSbcsDataGenerated () {
	if (hasRequiredSbcsDataGenerated) return sbcsDataGenerated;
	hasRequiredSbcsDataGenerated = 1;

	// Generated data for sbcs codec. Don't edit manually. Regenerate using generation/gen-sbcs.js script.
	sbcsDataGenerated = {
	  "437": "cp437",
	  "737": "cp737",
	  "775": "cp775",
	  "850": "cp850",
	  "852": "cp852",
	  "855": "cp855",
	  "856": "cp856",
	  "857": "cp857",
	  "858": "cp858",
	  "860": "cp860",
	  "861": "cp861",
	  "862": "cp862",
	  "863": "cp863",
	  "864": "cp864",
	  "865": "cp865",
	  "866": "cp866",
	  "869": "cp869",
	  "874": "windows874",
	  "922": "cp922",
	  "28598": "iso88598",
	  "28599": "iso88599",
	  "28600": "iso885910",
	  "28601": "iso885911",
	  "28603": "iso885913",
	  "28604": "iso885914",
	  "28605": "iso885915",
	  "28606": "iso885916",
	  "windows874": {
	    "type": "_sbcs",
	    "chars": "€����…�����������‘’“”•–—�������� กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
	  }	  
	};
	return sbcsDataGenerated;
}

var dbcsCodec = {};

var hasRequiredDbcsCodec;

function requireDbcsCodec () {
	if (hasRequiredDbcsCodec) return dbcsCodec;
	hasRequiredDbcsCodec = 1;
	var Buffer = requireSafer().Buffer;


	dbcsCodec._dbcs = DBCSCodec;

	var UNASSIGNED = -1,
	    GB18030_CODE = -2,
	    SEQ_START  = -10,
	    NODE_START = -1000,
	    UNASSIGNED_NODE = new Array(0x100),
	    DEF_CHAR = -1;

	for (var i = 0; i < 0x100; i++)
	    UNASSIGNED_NODE[i] = UNASSIGNED;


	// Class DBCSCodec reads and initializes mapping tables.
	function DBCSCodec(codecOptions, iconv) {
	    this.encodingName = codecOptions.encodingName;
	    if (!codecOptions)
	        throw new Error("DBCS codec is called without the data.")
	    if (!codecOptions.table)
	        throw new Error("Encoding '" + this.encodingName + "' has no data.");

	    // Load tables.
	    var mappingTable = codecOptions.table();


	    this.decodeTables = [];
	    this.decodeTables[0] = UNASSIGNED_NODE.slice(0); // Create root node.

	    // Sometimes a MBCS char corresponds to a sequence of unicode chars. We store them as arrays of integers here. 
	    this.decodeTableSeq = [];

	    // Actual mapping tables consist of chunks. Use them to fill up decode tables.
	    for (var i = 0; i < mappingTable.length; i++)
	        this._addDecodeChunk(mappingTable[i]);

	    this.defaultCharUnicode = iconv.defaultCharUnicode;

	    this.encodeTable = [];

	    this.encodeTableSeq = [];

	    // Some chars can be decoded, but need not be encoded.
	    var skipEncodeChars = {};
	    if (codecOptions.encodeSkipVals)
	        for (var i = 0; i < codecOptions.encodeSkipVals.length; i++) {
	            var val = codecOptions.encodeSkipVals[i];
	            if (typeof val === 'number')
	                skipEncodeChars[val] = true;
	            else
	                for (var j = val.from; j <= val.to; j++)
	                    skipEncodeChars[j] = true;
	        }
	        
	    // Use decode trie to recursively fill out encode tables.
	    this._fillEncodeTable(0, 0, skipEncodeChars);

	    // Add more encoding pairs when needed.
	    if (codecOptions.encodeAdd) {
	        for (var uChar in codecOptions.encodeAdd)
	            if (Object.prototype.hasOwnProperty.call(codecOptions.encodeAdd, uChar))
	                this._setEncodeChar(uChar.charCodeAt(0), codecOptions.encodeAdd[uChar]);
	    }

	    this.defCharSB  = this.encodeTable[0][iconv.defaultCharSingleByte.charCodeAt(0)];
	    if (this.defCharSB === UNASSIGNED) this.defCharSB = this.encodeTable[0]['?'];
	    if (this.defCharSB === UNASSIGNED) this.defCharSB = "?".charCodeAt(0);


	    // Load & create GB18030 tables when needed.
	    if (typeof codecOptions.gb18030 === 'function') {
	        this.gb18030 = codecOptions.gb18030(); // Load GB18030 ranges.

	        // Add GB18030 decode tables.
	        var thirdByteNodeIdx = this.decodeTables.length;
	        var thirdByteNode = this.decodeTables[thirdByteNodeIdx] = UNASSIGNED_NODE.slice(0);

	        var fourthByteNodeIdx = this.decodeTables.length;
	        var fourthByteNode = this.decodeTables[fourthByteNodeIdx] = UNASSIGNED_NODE.slice(0);

	        for (var i = 0x81; i <= 0xFE; i++) {
	            var secondByteNodeIdx = NODE_START - this.decodeTables[0][i];
	            var secondByteNode = this.decodeTables[secondByteNodeIdx];
	            for (var j = 0x30; j <= 0x39; j++)
	                secondByteNode[j] = NODE_START - thirdByteNodeIdx;
	        }
	        for (var i = 0x81; i <= 0xFE; i++)
	            thirdByteNode[i] = NODE_START - fourthByteNodeIdx;
	        for (var i = 0x30; i <= 0x39; i++)
	            fourthByteNode[i] = GB18030_CODE;
	    }        
	}

	DBCSCodec.prototype.encoder = DBCSEncoder;
	DBCSCodec.prototype.decoder = DBCSDecoder;

	// Decoder helpers
	DBCSCodec.prototype._getDecodeTrieNode = function(addr) {
	    var bytes = [];
	    for (; addr > 0; addr >>= 8)
	        bytes.push(addr & 0xFF);
	    if (bytes.length == 0)
	        bytes.push(0);

	    var node = this.decodeTables[0];
	    for (var i = bytes.length-1; i > 0; i--) { // Traverse nodes deeper into the trie.
	        var val = node[bytes[i]];

	        if (val == UNASSIGNED) { // Create new node.
	            node[bytes[i]] = NODE_START - this.decodeTables.length;
	            this.decodeTables.push(node = UNASSIGNED_NODE.slice(0));
	        }
	        else if (val <= NODE_START) { // Existing node.
	            node = this.decodeTables[NODE_START - val];
	        }
	        else
	            throw new Error("Overwrite byte in " + this.encodingName + ", addr: " + addr.toString(16));
	    }
	    return node;
	};


	DBCSCodec.prototype._addDecodeChunk = function(chunk) {
	    // First element of chunk is the hex mbcs code where we start.
	    var curAddr = parseInt(chunk[0], 16);

	    // Choose the decoding node where we'll write our chars.
	    var writeTable = this._getDecodeTrieNode(curAddr);
	    curAddr = curAddr & 0xFF;

	    // Write all other elements of the chunk to the table.
	    for (var k = 1; k < chunk.length; k++) {
	        var part = chunk[k];
	        if (typeof part === "string") { // String, write as-is.
	            for (var l = 0; l < part.length;) {
	                var code = part.charCodeAt(l++);
	                if (0xD800 <= code && code < 0xDC00) { // Decode surrogate
	                    var codeTrail = part.charCodeAt(l++);
	                    if (0xDC00 <= codeTrail && codeTrail < 0xE000)
	                        writeTable[curAddr++] = 0x10000 + (code - 0xD800) * 0x400 + (codeTrail - 0xDC00);
	                    else
	                        throw new Error("Incorrect surrogate pair in "  + this.encodingName + " at chunk " + chunk[0]);
	                }
	                else if (0x0FF0 < code && code <= 0x0FFF) { // Character sequence (our own encoding used)
	                    var len = 0xFFF - code + 2;
	                    var seq = [];
	                    for (var m = 0; m < len; m++)
	                        seq.push(part.charCodeAt(l++)); // Simple variation: don't support surrogates or subsequences in seq.

	                    writeTable[curAddr++] = SEQ_START - this.decodeTableSeq.length;
	                    this.decodeTableSeq.push(seq);
	                }
	                else
	                    writeTable[curAddr++] = code; // Basic char
	            }
	        } 
	        else if (typeof part === "number") { // Integer, meaning increasing sequence starting with prev character.
	            var charCode = writeTable[curAddr - 1] + 1;
	            for (var l = 0; l < part; l++)
	                writeTable[curAddr++] = charCode++;
	        }
	        else
	            throw new Error("Incorrect type '" + typeof part + "' given in "  + this.encodingName + " at chunk " + chunk[0]);
	    }
	    if (curAddr > 0xFF)
	        throw new Error("Incorrect chunk in "  + this.encodingName + " at addr " + chunk[0] + ": too long" + curAddr);
	};

	// Encoder helpers
	DBCSCodec.prototype._getEncodeBucket = function(uCode) {
	    var high = uCode >> 8; // This could be > 0xFF because of astral characters.
	    if (this.encodeTable[high] === undefined)
	        this.encodeTable[high] = UNASSIGNED_NODE.slice(0); // Create bucket on demand.
	    return this.encodeTable[high];
	};

	DBCSCodec.prototype._setEncodeChar = function(uCode, dbcsCode) {
	    var bucket = this._getEncodeBucket(uCode);
	    var low = uCode & 0xFF;
	    if (bucket[low] <= SEQ_START)
	        this.encodeTableSeq[SEQ_START-bucket[low]][DEF_CHAR] = dbcsCode; // There's already a sequence, set a single-char subsequence of it.
	    else if (bucket[low] == UNASSIGNED)
	        bucket[low] = dbcsCode;
	};

	DBCSCodec.prototype._setEncodeSequence = function(seq, dbcsCode) {
	    
	    // Get the root of character tree according to first character of the sequence.
	    var uCode = seq[0];
	    var bucket = this._getEncodeBucket(uCode);
	    var low = uCode & 0xFF;

	    var node;
	    if (bucket[low] <= SEQ_START) {
	        // There's already a sequence with  - use it.
	        node = this.encodeTableSeq[SEQ_START-bucket[low]];
	    }
	    else {
	        // There was no sequence object - allocate a new one.
	        node = {};
	        if (bucket[low] !== UNASSIGNED) node[DEF_CHAR] = bucket[low]; // If a char was set before - make it a single-char subsequence.
	        bucket[low] = SEQ_START - this.encodeTableSeq.length;
	        this.encodeTableSeq.push(node);
	    }

	    // Traverse the character tree, allocating new nodes as needed.
	    for (var j = 1; j < seq.length-1; j++) {
	        var oldVal = node[uCode];
	        if (typeof oldVal === 'object')
	            node = oldVal;
	        else {
	            node = node[uCode] = {};
	            if (oldVal !== undefined)
	                node[DEF_CHAR] = oldVal;
	        }
	    }

	    // Set the leaf to given dbcsCode.
	    uCode = seq[seq.length-1];
	    node[uCode] = dbcsCode;
	};

	DBCSCodec.prototype._fillEncodeTable = function(nodeIdx, prefix, skipEncodeChars) {
	    var node = this.decodeTables[nodeIdx];
	    for (var i = 0; i < 0x100; i++) {
	        var uCode = node[i];
	        var mbCode = prefix + i;
	        if (skipEncodeChars[mbCode])
	            continue;

	        if (uCode >= 0)
	            this._setEncodeChar(uCode, mbCode);
	        else if (uCode <= NODE_START)
	            this._fillEncodeTable(NODE_START - uCode, mbCode << 8, skipEncodeChars);
	        else if (uCode <= SEQ_START)
	            this._setEncodeSequence(this.decodeTableSeq[SEQ_START - uCode], mbCode);
	    }
	};



	// == Encoder ==================================================================

	function DBCSEncoder(options, codec) {
	    // Encoder state
	    this.leadSurrogate = -1;
	    this.seqObj = undefined;
	    
	    // Static data
	    this.encodeTable = codec.encodeTable;
	    this.encodeTableSeq = codec.encodeTableSeq;
	    this.defaultCharSingleByte = codec.defCharSB;
	    this.gb18030 = codec.gb18030;
	}

	DBCSEncoder.prototype.write = function(str) {
	    var newBuf = Buffer.alloc(str.length * (this.gb18030 ? 4 : 3)),
	        leadSurrogate = this.leadSurrogate,
	        seqObj = this.seqObj, nextChar = -1,
	        i = 0, j = 0;

	    while (true) {
	        // 0. Get next character.
	        if (nextChar === -1) {
	            if (i == str.length) break;
	            var uCode = str.charCodeAt(i++);
	        }
	        else {
	            var uCode = nextChar;
	            nextChar = -1;    
	        }

	        // 1. Handle surrogates.
	        if (0xD800 <= uCode && uCode < 0xE000) { // Char is one of surrogates.
	            if (uCode < 0xDC00) { // We've got lead surrogate.
	                if (leadSurrogate === -1) {
	                    leadSurrogate = uCode;
	                    continue;
	                } else {
	                    leadSurrogate = uCode;
	                    // Double lead surrogate found.
	                    uCode = UNASSIGNED;
	                }
	            } else { // We've got trail surrogate.
	                if (leadSurrogate !== -1) {
	                    uCode = 0x10000 + (leadSurrogate - 0xD800) * 0x400 + (uCode - 0xDC00);
	                    leadSurrogate = -1;
	                } else {
	                    // Incomplete surrogate pair - only trail surrogate found.
	                    uCode = UNASSIGNED;
	                }
	                
	            }
	        }
	        else if (leadSurrogate !== -1) {
	            // Incomplete surrogate pair - only lead surrogate found.
	            nextChar = uCode; uCode = UNASSIGNED; // Write an error, then current char.
	            leadSurrogate = -1;
	        }

	        // 2. Convert uCode character.
	        var dbcsCode = UNASSIGNED;
	        if (seqObj !== undefined && uCode != UNASSIGNED) { // We are in the middle of the sequence
	            var resCode = seqObj[uCode];
	            if (typeof resCode === 'object') { // Sequence continues.
	                seqObj = resCode;
	                continue;

	            } else if (typeof resCode == 'number') { // Sequence finished. Write it.
	                dbcsCode = resCode;

	            } else if (resCode == undefined) { // Current character is not part of the sequence.

	                // Try default character for this sequence
	                resCode = seqObj[DEF_CHAR];
	                if (resCode !== undefined) {
	                    dbcsCode = resCode; // Found. Write it.
	                    nextChar = uCode; // Current character will be written too in the next iteration.

	                }
	            }
	            seqObj = undefined;
	        }
	        else if (uCode >= 0) {  // Regular character
	            var subtable = this.encodeTable[uCode >> 8];
	            if (subtable !== undefined)
	                dbcsCode = subtable[uCode & 0xFF];
	            
	            if (dbcsCode <= SEQ_START) { // Sequence start
	                seqObj = this.encodeTableSeq[SEQ_START-dbcsCode];
	                continue;
	            }

	            if (dbcsCode == UNASSIGNED && this.gb18030) {
	                // Use GB18030 algorithm to find character(s) to write.
	                var idx = findIdx(this.gb18030.uChars, uCode);
	                if (idx != -1) {
	                    var dbcsCode = this.gb18030.gbChars[idx] + (uCode - this.gb18030.uChars[idx]);
	                    newBuf[j++] = 0x81 + Math.floor(dbcsCode / 12600); dbcsCode = dbcsCode % 12600;
	                    newBuf[j++] = 0x30 + Math.floor(dbcsCode / 1260); dbcsCode = dbcsCode % 1260;
	                    newBuf[j++] = 0x81 + Math.floor(dbcsCode / 10); dbcsCode = dbcsCode % 10;
	                    newBuf[j++] = 0x30 + dbcsCode;
	                    continue;
	                }
	            }
	        }

	        // 3. Write dbcsCode character.
	        if (dbcsCode === UNASSIGNED)
	            dbcsCode = this.defaultCharSingleByte;
	        
	        if (dbcsCode < 0x100) {
	            newBuf[j++] = dbcsCode;
	        }
	        else if (dbcsCode < 0x10000) {
	            newBuf[j++] = dbcsCode >> 8;   // high byte
	            newBuf[j++] = dbcsCode & 0xFF; // low byte
	        }
	        else {
	            newBuf[j++] = dbcsCode >> 16;
	            newBuf[j++] = (dbcsCode >> 8) & 0xFF;
	            newBuf[j++] = dbcsCode & 0xFF;
	        }
	    }

	    this.seqObj = seqObj;
	    this.leadSurrogate = leadSurrogate;
	    return newBuf.slice(0, j);
	};

	DBCSEncoder.prototype.end = function() {
	    if (this.leadSurrogate === -1 && this.seqObj === undefined)
	        return; // All clean. Most often case.

	    var newBuf = Buffer.alloc(10), j = 0;

	    if (this.seqObj) { // We're in the sequence.
	        var dbcsCode = this.seqObj[DEF_CHAR];
	        if (dbcsCode !== undefined) { // Write beginning of the sequence.
	            if (dbcsCode < 0x100) {
	                newBuf[j++] = dbcsCode;
	            }
	            else {
	                newBuf[j++] = dbcsCode >> 8;   // high byte
	                newBuf[j++] = dbcsCode & 0xFF; // low byte
	            }
	        }
	        this.seqObj = undefined;
	    }

	    if (this.leadSurrogate !== -1) {
	        // Incomplete surrogate pair - only lead surrogate found.
	        newBuf[j++] = this.defaultCharSingleByte;
	        this.leadSurrogate = -1;
	    }
	    
	    return newBuf.slice(0, j);
	};

	// Export for testing
	DBCSEncoder.prototype.findIdx = findIdx;


	// == Decoder ==================================================================

	function DBCSDecoder(options, codec) {
	    // Decoder state
	    this.nodeIdx = 0;
	    this.prevBuf = Buffer.alloc(0);

	    // Static data
	    this.decodeTables = codec.decodeTables;
	    this.decodeTableSeq = codec.decodeTableSeq;
	    this.defaultCharUnicode = codec.defaultCharUnicode;
	    this.gb18030 = codec.gb18030;
	}

	DBCSDecoder.prototype.write = function(buf) {
	    var newBuf = Buffer.alloc(buf.length*2),
	        nodeIdx = this.nodeIdx, 
	        prevBuf = this.prevBuf, prevBufOffset = this.prevBuf.length,
	        seqStart = -this.prevBuf.length, // idx of the start of current parsed sequence.
	        uCode;

	    if (prevBufOffset > 0) // Make prev buf overlap a little to make it easier to slice later.
	        prevBuf = Buffer.concat([prevBuf, buf.slice(0, 10)]);
	    
	    for (var i = 0, j = 0; i < buf.length; i++) {
	        var curByte = (i >= 0) ? buf[i] : prevBuf[i + prevBufOffset];

	        // Lookup in current trie node.
	        var uCode = this.decodeTables[nodeIdx][curByte];

	        if (uCode >= 0) ;
	        else if (uCode === UNASSIGNED) { // Unknown char.
	            // TODO: Callback with seq.
	            //var curSeq = (seqStart >= 0) ? buf.slice(seqStart, i+1) : prevBuf.slice(seqStart + prevBufOffset, i+1 + prevBufOffset);
	            i = seqStart; // Try to parse again, after skipping first byte of the sequence ('i' will be incremented by 'for' cycle).
	            uCode = this.defaultCharUnicode.charCodeAt(0);
	        }
	        else if (uCode === GB18030_CODE) {
	            var curSeq = (seqStart >= 0) ? buf.slice(seqStart, i+1) : prevBuf.slice(seqStart + prevBufOffset, i+1 + prevBufOffset);
	            var ptr = (curSeq[0]-0x81)*12600 + (curSeq[1]-0x30)*1260 + (curSeq[2]-0x81)*10 + (curSeq[3]-0x30);
	            var idx = findIdx(this.gb18030.gbChars, ptr);
	            uCode = this.gb18030.uChars[idx] + ptr - this.gb18030.gbChars[idx];
	        }
	        else if (uCode <= NODE_START) { // Go to next trie node.
	            nodeIdx = NODE_START - uCode;
	            continue;
	        }
	        else if (uCode <= SEQ_START) { // Output a sequence of chars.
	            var seq = this.decodeTableSeq[SEQ_START - uCode];
	            for (var k = 0; k < seq.length - 1; k++) {
	                uCode = seq[k];
	                newBuf[j++] = uCode & 0xFF;
	                newBuf[j++] = uCode >> 8;
	            }
	            uCode = seq[seq.length-1];
	        }
	        else
	            throw new Error("iconv-lite internal error: invalid decoding table value " + uCode + " at " + nodeIdx + "/" + curByte);

	        // Write the character to buffer, handling higher planes using surrogate pair.
	        if (uCode > 0xFFFF) { 
	            uCode -= 0x10000;
	            var uCodeLead = 0xD800 + Math.floor(uCode / 0x400);
	            newBuf[j++] = uCodeLead & 0xFF;
	            newBuf[j++] = uCodeLead >> 8;

	            uCode = 0xDC00 + uCode % 0x400;
	        }
	        newBuf[j++] = uCode & 0xFF;
	        newBuf[j++] = uCode >> 8;

	        // Reset trie node.
	        nodeIdx = 0; seqStart = i+1;
	    }

	    this.nodeIdx = nodeIdx;
	    this.prevBuf = (seqStart >= 0) ? buf.slice(seqStart) : prevBuf.slice(seqStart + prevBufOffset);
	    return newBuf.slice(0, j).toString('ucs2');
	};

	DBCSDecoder.prototype.end = function() {
	    var ret = '';

	    // Try to parse all remaining chars.
	    while (this.prevBuf.length > 0) {
	        // Skip 1 character in the buffer.
	        ret += this.defaultCharUnicode;
	        var buf = this.prevBuf.slice(1);

	        // Parse remaining as usual.
	        this.prevBuf = Buffer.alloc(0);
	        this.nodeIdx = 0;
	        if (buf.length > 0)
	            ret += this.write(buf);
	    }

	    this.nodeIdx = 0;
	    return ret;
	};

	// Binary search for GB18030. Returns largest i such that table[i] <= val.
	function findIdx(table, val) {
	    if (table[0] > val)
	        return -1;

	    var l = 0, r = table.length;
	    while (l < r-1) { // always table[l] <= val < table[r]
	        var mid = l + Math.floor((r-l+1)/2);
	        if (table[mid] <= val)
	            l = mid;
	        else
	            r = mid;
	    }
	    return l;
	}
	return dbcsCodec;
}

var require$$0$1 = [
	[
		"0",
		"\u0000",
		128
	],
	[
		"a1",
		"｡",
		62
	]
];

var require$$1 = [
	[
		"0",
		"\u0000",
		127
	],
	[
		"8ea1",
		"｡",
		62
	]
];

var require$$2 = [
	[
		"0",
		"\u0000",
		127,
		"€"
	],
	[
		"8140",
		"丂丄丅丆丏丒丗丟丠両丣並丩丮丯丱丳丵丷丼乀乁乂乄乆乊乑乕乗乚乛乢乣乤乥乧乨乪",
		5,
		"乲乴",
		9,
		"乿",
		6,
		"亇亊"
	]
];

var require$$3 = [
	[
		"a140",
		"",
		62
	],
	[
		"a180",
		"",
		32
	]
];

var uChars = [
	128,
	165
];
var gbChars = [
	0,
	36,
	38,
	45,
	50,
	81,
	89,
	95,
	96,
	100,
	103	
];
var require$$4 = {
	uChars: uChars,
	gbChars: gbChars
};

var require$$5 = [
	[
		"0",
		"\u0000",
		127
	],
	[
		"8141",
		"갂갃갅갆갋",
		4,
		"갘갞갟갡갢갣갥",
		6,
		"갮갲갳갴"
	]
];

var require$$6 = [
	[
		"0",
		"\u0000",
		127
	],
	[
		"a140",
		"　，、。．‧；：？！︰…‥﹐﹑﹒·﹔﹕﹖﹗｜–︱—︳╴︴﹏（）︵︶｛｝︷︸〔〕︹︺【】︻︼《》︽︾〈〉︿﹀「」﹁﹂『』﹃﹄﹙﹚"
	]
];

var require$$7 = [
	[
		"8740",
		"䏰䰲䘃䖦䕸𧉧䵷䖳𧲱䳢𧳅㮕䜶䝄䱇䱀𤊿𣘗𧍒𦺋𧃒䱗𪍑䝏䗚䲅𧱬䴇䪤䚡𦬣爥𥩔𡩣𣸆𣽡晍囻"
	]
];

var dbcsData;
var hasRequiredDbcsData;

function requireDbcsData () {
	if (hasRequiredDbcsData) return dbcsData;
	hasRequiredDbcsData = 1;

	dbcsData = {	 

	    'shiftjis': {
	        type: '_dbcs',
	        table: function() { return require$$0$1 },
	        encodeAdd: {'\u00a5': 0x5C, '\u203E': 0x7E},
	        encodeSkipVals: [{from: 0xED40, to: 0xF940}],
	    },
	    'csshiftjis': 'shiftjis',
	    'mskanji': 'shiftjis',
	    'sjis': 'shiftjis',
	    'windows31j': 'shiftjis',
	    'ms31j': 'shiftjis',
	    'xsjis': 'shiftjis',
	    'windows932': 'shiftjis',
	    'ms932': 'shiftjis',
	    '932': 'shiftjis',
	    'cp932': 'shiftjis',

	    'eucjp': {
	        type: '_dbcs',
	        table: function() { return require$$1 },
	        encodeAdd: {'\u00a5': 0x5C, '\u203E': 0x7E},
	    },

	    'gb2312': 'cp936',
	    'gb231280': 'cp936',
	    'gb23121980': 'cp936',
	    'csgb2312': 'cp936',
	    'csiso58gb231280': 'cp936',
	    'euccn': 'cp936',

	    // Microsoft's CP936 is a subset and approximation of GBK.
	    'windows936': 'cp936',
	    'ms936': 'cp936',
	    '936': 'cp936',
	    'cp936': {
	        type: '_dbcs',
	        table: function() { return require$$2 },
	    },

	    // GBK (~22000 chars) is an extension of CP936 that added user-mapped chars and some other.
	    'gbk': {
	        type: '_dbcs',
	        table: function() { return require$$2.concat(require$$3) },
	    },
	    'xgbk': 'gbk',
	    'isoir58': 'gbk',
	    'gb18030': {
	        type: '_dbcs',
	        table: function() { return require$$2.concat(require$$3) },
	        gb18030: function() { return require$$4 },
	        encodeSkipVals: [0x80],
	        encodeAdd: {'€': 0xA2E3},
	    },

	    'chinese': 'gb18030',
	    'windows949': 'cp949',
	    'ms949': 'cp949',
	    '949': 'cp949',
	    'cp949': {
	        type: '_dbcs',
	        table: function() { return require$$5 },
	    },

	    'cseuckr': 'cp949',
	    'csksc56011987': 'cp949',
	    'euckr': 'cp949',
	    'isoir149': 'cp949',
	    'korean': 'cp949',
	    'ksc56011987': 'cp949',
	    'ksc56011989': 'cp949',
	    'ksc5601': 'cp949',


	    'windows950': 'cp950',
	    'ms950': 'cp950',
	    '950': 'cp950',
	    'cp950': {
	        type: '_dbcs',
	        table: function() { return require$$6 },
	    },

	    // Big5 has many variations and is an extension of cp950. We use Encoding Standard's as a consensus.
	    'big5': 'big5hkscs',
	    'big5hkscs': {
	        type: '_dbcs',
	        table: function() { return require$$6.concat(require$$7) },
	        encodeSkipVals: [0xa2cc],
	    },

	    'cnbig5': 'big5hkscs',
	    'csbig5': 'big5hkscs',
	    'xxbig5': 'big5hkscs',
	};
	return dbcsData;
}

var hasRequiredEncodings;

function requireEncodings () {
	if (hasRequiredEncodings) return encodings;
	hasRequiredEncodings = 1;
	(function (exports) {

		var modules = [
		    requireInternal(),
		    requireUtf16(),
		    requireUtf7(),
		    requireSbcsCodec(),
		    requireSbcsData(),
		    requireSbcsDataGenerated(),
		    requireDbcsCodec(),
		    requireDbcsData(),
		];

		// Put all encoding/alias/codec definitions to single object and export it. 
		for (var i = 0; i < modules.length; i++) {
		    var module = modules[i];
		    for (var enc in module)
		        if (Object.prototype.hasOwnProperty.call(module, enc))
		            exports[enc] = module[enc];
		} 
	} (encodings));
	return encodings;
}

var streams;
var hasRequiredStreams;

function requireStreams () {
	if (hasRequiredStreams) return streams;
	hasRequiredStreams = 1;

	var Buffer = require$$0$8.Buffer,
	    Transform = require$$1$2.Transform;


	// == Exports ==================================================================
	streams = function(iconv) {
	    
	    // Additional Public API.
	    iconv.encodeStream = function encodeStream(encoding, options) {
	        return new IconvLiteEncoderStream(iconv.getEncoder(encoding, options), options);
	    };

	    iconv.decodeStream = function decodeStream(encoding, options) {
	        return new IconvLiteDecoderStream(iconv.getDecoder(encoding, options), options);
	    };

	    iconv.supportsStreams = true;


	    // Not published yet.
	    iconv.IconvLiteEncoderStream = IconvLiteEncoderStream;
	    iconv.IconvLiteDecoderStream = IconvLiteDecoderStream;
	    iconv._collect = IconvLiteDecoderStream.prototype.collect;
	};


	// == Encoder stream =======================================================
	function IconvLiteEncoderStream(conv, options) {
	    this.conv = conv;
	    options = options || {};
	    options.decodeStrings = false; // We accept only strings, so we don't need to decode them.
	    Transform.call(this, options);
	}

	IconvLiteEncoderStream.prototype = Object.create(Transform.prototype, {
	    constructor: { value: IconvLiteEncoderStream }
	});

	IconvLiteEncoderStream.prototype._transform = function(chunk, encoding, done) {
	    if (typeof chunk != 'string')
	        return done(new Error("Iconv encoding stream needs strings as its input."));
	    try {
	        var res = this.conv.write(chunk);
	        if (res && res.length) this.push(res);
	        done();
	    }
	    catch (e) {
	        done(e);
	    }
	};

	IconvLiteEncoderStream.prototype._flush = function(done) {
	    try {
	        var res = this.conv.end();
	        if (res && res.length) this.push(res);
	        done();
	    }
	    catch (e) {
	        done(e);
	    }
	};

	IconvLiteEncoderStream.prototype.collect = function(cb) {
	    var chunks = [];
	    this.on('error', cb);
	    this.on('data', function(chunk) { chunks.push(chunk); });
	    this.on('end', function() {
	        cb(null, Buffer.concat(chunks));
	    });
	    return this;
	};


	// == Decoder stream =======================================================
	function IconvLiteDecoderStream(conv, options) {
	    this.conv = conv;
	    options = options || {};
	    options.encoding = this.encoding = 'utf8'; // We output strings.
	    Transform.call(this, options);
	}

	IconvLiteDecoderStream.prototype = Object.create(Transform.prototype, {
	    constructor: { value: IconvLiteDecoderStream }
	});

	IconvLiteDecoderStream.prototype._transform = function(chunk, encoding, done) {
	    if (!Buffer.isBuffer(chunk))
	        return done(new Error("Iconv decoding stream needs buffers as its input."));
	    try {
	        var res = this.conv.write(chunk);
	        if (res && res.length) this.push(res, this.encoding);
	        done();
	    }
	    catch (e) {
	        done(e);
	    }
	};

	IconvLiteDecoderStream.prototype._flush = function(done) {
	    try {
	        var res = this.conv.end();
	        if (res && res.length) this.push(res, this.encoding);                
	        done();
	    }
	    catch (e) {
	        done(e);
	    }
	};

	IconvLiteDecoderStream.prototype.collect = function(cb) {
	    var res = '';
	    this.on('error', cb);
	    this.on('data', function(chunk) { res += chunk; });
	    this.on('end', function() {
	        cb(null, res);
	    });
	    return this;
	};
	return streams;
}

var extendNode;
var hasRequiredExtendNode;

function requireExtendNode () {
	if (hasRequiredExtendNode) return extendNode;
	hasRequiredExtendNode = 1;
	var Buffer = require$$0$8.Buffer;

	extendNode = function (iconv) {
	    var original = undefined; // Place to keep original methods.

	    iconv.supportsNodeEncodingsExtension = !(Buffer.from || new Buffer(0) instanceof Uint8Array);

	    iconv.extendNodeEncodings = function extendNodeEncodings() {
	        if (original) return;
	        original = {};

	        if (!iconv.supportsNodeEncodingsExtension) {
	            console.error("ACTION NEEDED: require('iconv-lite').extendNodeEncodings() is not supported in your version of Node");
	            console.error("See more info at https://github.com/ashtuchkin/iconv-lite/wiki/Node-v4-compatibility");
	            return;
	        }

	        var nodeNativeEncodings = {
	            'hex': true, 'utf8': true, 'utf-8': true, 'ascii': true, 'binary': true, 
	            'base64': true, 'ucs2': true, 'ucs-2': true, 'utf16le': true, 'utf-16le': true,
	        };

	        Buffer.isNativeEncoding = function(enc) {
	            return enc && nodeNativeEncodings[enc.toLowerCase()];
	        };
	        var SlowBuffer = require$$0$8.SlowBuffer;

	        original.SlowBufferToString = SlowBuffer.prototype.toString;
	        SlowBuffer.prototype.toString = function(encoding, start, end) {
	            encoding = String(encoding || 'utf8').toLowerCase();

	            // Use native conversion when possible
	            if (Buffer.isNativeEncoding(encoding))
	                return original.SlowBufferToString.call(this, encoding, start, end);

	            // Otherwise, use our decoding method.
	            if (typeof start == 'undefined') start = 0;
	            if (typeof end == 'undefined') end = this.length;
	            return iconv.decode(this.slice(start, end), encoding);
	        };

	        original.SlowBufferWrite = SlowBuffer.prototype.write;
	        SlowBuffer.prototype.write = function(string, offset, length, encoding) {
	            if (isFinite(offset)) {
	                if (!isFinite(length)) {
	                    encoding = length;
	                    length = undefined;
	                }
	            } else {  // legacy
	                var swap = encoding;
	                encoding = offset;
	                offset = length;
	                length = swap;
	            }

	            offset = +offset || 0;
	            var remaining = this.length - offset;
	            if (!length) {
	                length = remaining;
	            } else {
	                length = +length;
	                if (length > remaining) {
	                    length = remaining;
	                }
	            }
	            encoding = String(encoding || 'utf8').toLowerCase();

	            // Use native conversion when possible
	            if (Buffer.isNativeEncoding(encoding))
	                return original.SlowBufferWrite.call(this, string, offset, length, encoding);

	            if (string.length > 0 && (length < 0 || offset < 0))
	                throw new RangeError('attempt to write beyond buffer bounds');

	            // Otherwise, use our encoding method.
	            var buf = iconv.encode(string, encoding);
	            if (buf.length < length) length = buf.length;
	            buf.copy(this, offset, 0, length);
	            return length;
	        };

	        original.BufferIsEncoding = Buffer.isEncoding;
	        Buffer.isEncoding = function(encoding) {
	            return Buffer.isNativeEncoding(encoding) || iconv.encodingExists(encoding);
	        };

	        original.BufferByteLength = Buffer.byteLength;
	        Buffer.byteLength = SlowBuffer.byteLength = function(str, encoding) {
	            encoding = String(encoding || 'utf8').toLowerCase();

	            // Use native conversion when possible
	            if (Buffer.isNativeEncoding(encoding))
	                return original.BufferByteLength.call(this, str, encoding);

	            // Slow, I know, but we don't have a better way yet.
	            return iconv.encode(str, encoding).length;
	        };

	        original.BufferToString = Buffer.prototype.toString;
	        Buffer.prototype.toString = function(encoding, start, end) {
	            encoding = String(encoding || 'utf8').toLowerCase();

	            // Use native conversion when possible
	            if (Buffer.isNativeEncoding(encoding))
	                return original.BufferToString.call(this, encoding, start, end);

	            // Otherwise, use our decoding method.
	            if (typeof start == 'undefined') start = 0;
	            if (typeof end == 'undefined') end = this.length;
	            return iconv.decode(this.slice(start, end), encoding);
	        };

	        original.BufferWrite = Buffer.prototype.write;
	        Buffer.prototype.write = function(string, offset, length, encoding) {
	            var _offset = offset, _length = length, _encoding = encoding;
	            if (isFinite(offset)) {
	                if (!isFinite(length)) {
	                    encoding = length;
	                    length = undefined;
	                }
	            } else {  // legacy
	                var swap = encoding;
	                encoding = offset;
	                offset = length;
	                length = swap;
	            }

	            encoding = String(encoding || 'utf8').toLowerCase();

	            // Use native conversion when possible
	            if (Buffer.isNativeEncoding(encoding))
	                return original.BufferWrite.call(this, string, _offset, _length, _encoding);

	            offset = +offset || 0;
	            var remaining = this.length - offset;
	            if (!length) {
	                length = remaining;
	            } else {
	                length = +length;
	                if (length > remaining) {
	                    length = remaining;
	                }
	            }

	            if (string.length > 0 && (length < 0 || offset < 0))
	                throw new RangeError('attempt to write beyond buffer bounds');

	            // Otherwise, use our encoding method.
	            var buf = iconv.encode(string, encoding);
	            if (buf.length < length) length = buf.length;
	            buf.copy(this, offset, 0, length);
	            return length;

	            // TODO: Set _charsWritten.
	        };


	        // -- Readable -------------------------------------------------------------
	        if (iconv.supportsStreams) {
	            var Readable = require$$1$2.Readable;

	            original.ReadableSetEncoding = Readable.prototype.setEncoding;
	            Readable.prototype.setEncoding = function setEncoding(enc, options) {
	                // Use our own decoder, it has the same interface.
	                // We cannot use original function as it doesn't handle BOM-s.
	                this._readableState.decoder = iconv.getDecoder(enc, options);
	                this._readableState.encoding = enc;
	            };

	            Readable.prototype.collect = iconv._collect;
	        }
	    };

	    // Remove iconv-lite Node primitive extensions.
	    iconv.undoExtendNodeEncodings = function undoExtendNodeEncodings() {
	        if (!iconv.supportsNodeEncodingsExtension)
	            return;
	        if (!original)
	            throw new Error("require('iconv-lite').undoExtendNodeEncodings(): Nothing to undo; extendNodeEncodings() is not called.")

	        delete Buffer.isNativeEncoding;

	        var SlowBuffer = require$$0$8.SlowBuffer;

	        SlowBuffer.prototype.toString = original.SlowBufferToString;
	        SlowBuffer.prototype.write = original.SlowBufferWrite;

	        Buffer.isEncoding = original.BufferIsEncoding;
	        Buffer.byteLength = original.BufferByteLength;
	        Buffer.prototype.toString = original.BufferToString;
	        Buffer.prototype.write = original.BufferWrite;

	        if (iconv.supportsStreams) {
	            var Readable = require$$1$2.Readable;

	            Readable.prototype.setEncoding = original.ReadableSetEncoding;
	            delete Readable.prototype.collect;
	        }

	        original = undefined;
	    };
	};
	return extendNode;
}

var hasRequiredLib$1;

function requireLib$1 () {
	if (hasRequiredLib$1) return lib$2.exports;
	hasRequiredLib$1 = 1;
	(function (module) {
		var Buffer = requireSafer().Buffer;

		var bomHandling = requireBomHandling(),
		    iconv = module.exports;
		iconv.encodings = null;

		// Characters emitted in case of error.
		iconv.defaultCharUnicode = '�';
		iconv.defaultCharSingleByte = '?';

		// Public API.
		iconv.encode = function encode(str, encoding, options) {
		    str = "" + (str || ""); // Ensure string.

		    var encoder = iconv.getEncoder(encoding, options);

		    var res = encoder.write(str);
		    var trail = encoder.end();
		    
		    return (trail && trail.length > 0) ? Buffer.concat([res, trail]) : res;
		};

		iconv.decode = function decode(buf, encoding, options) {
		    if (typeof buf === 'string') {
		        if (!iconv.skipDecodeWarning) {
		            console.error('Iconv-lite warning: decode()-ing strings is deprecated. Refer to https://github.com/ashtuchkin/iconv-lite/wiki/Use-Buffers-when-decoding');
		            iconv.skipDecodeWarning = true;
		        }

		        buf = Buffer.from("" + (buf || ""), "binary"); // Ensure buffer.
		    }

		    var decoder = iconv.getDecoder(encoding, options);

		    var res = decoder.write(buf);
		    var trail = decoder.end();

		    return trail ? (res + trail) : res;
		};

		iconv.encodingExists = function encodingExists(enc) {
		    try {
		        iconv.getCodec(enc);
		        return true;
		    } catch (e) {
		        return false;
		    }
		};

		// Legacy aliases to convert functions
		iconv.toEncoding = iconv.encode;
		iconv.fromEncoding = iconv.decode;

		// Search for a codec in iconv.encodings. Cache codec data in iconv._codecDataCache.
		iconv._codecDataCache = {};
		iconv.getCodec = function getCodec(encoding) {
		    if (!iconv.encodings)
		        iconv.encodings = requireEncodings(); // Lazy load all encoding definitions.
		    
		    // Canonicalize encoding name: strip all non-alphanumeric chars and appended year.
		    var enc = iconv._canonicalizeEncoding(encoding);

		    // Traverse iconv.encodings to find actual codec.
		    var codecOptions = {};
		    while (true) {
		        var codec = iconv._codecDataCache[enc];
		        if (codec)
		            return codec;

		        var codecDef = iconv.encodings[enc];

		        switch (typeof codecDef) {
		            case "string": // Direct alias to other encoding.
		                enc = codecDef;
		                break;

		            case "object": // Alias with options. Can be layered.
		                for (var key in codecDef)
		                    codecOptions[key] = codecDef[key];

		                if (!codecOptions.encodingName)
		                    codecOptions.encodingName = enc;
		                
		                enc = codecDef.type;
		                break;

		            case "function": // Codec itself.
		                if (!codecOptions.encodingName)
		                    codecOptions.encodingName = enc;

		                codec = new codecDef(codecOptions, iconv);

		                iconv._codecDataCache[codecOptions.encodingName] = codec; // Save it to be reused later.
		                return codec;

		            default:
		                throw new Error("Encoding not recognized: '" + encoding + "' (searched as: '"+enc+"')");
		        }
		    }
		};

		iconv._canonicalizeEncoding = function(encoding) {
		    // Canonicalize encoding name: strip all non-alphanumeric chars and appended year.
		    return (''+encoding).toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, "");
		};

		iconv.getEncoder = function getEncoder(encoding, options) {
		    var codec = iconv.getCodec(encoding),
		        encoder = new codec.encoder(options, codec);

		    if (codec.bomAware && options && options.addBOM)
		        encoder = new bomHandling.PrependBOM(encoder, options);

		    return encoder;
		};

		iconv.getDecoder = function getDecoder(encoding, options) {
		    var codec = iconv.getCodec(encoding),
		        decoder = new codec.decoder(options, codec);

		    if (codec.bomAware && !(options && options.stripBOM === false))
		        decoder = new bomHandling.StripBOM(decoder, options);

		    return decoder;
		};


		// Load extensions in Node. All of them are omitted in Browserify build via 'browser' field in package.json.
		var nodeVer = typeof process !== 'undefined' && process.versions && process.versions.node;
		if (nodeVer) {

		    // Load streaming support in Node v0.10+
		    var nodeVerArr = nodeVer.split(".").map(Number);
		    if (nodeVerArr[0] > 0 || nodeVerArr[1] >= 10) {
		        requireStreams()(iconv);
		    }

		    // Load Node primitive extensions.
		    requireExtendNode()(iconv);
		}
	} (lib$2));
	return lib$2.exports;
}

var unpipe_1;
var hasRequiredUnpipe;

function requireUnpipe () {
	if (hasRequiredUnpipe) return unpipe_1;
	hasRequiredUnpipe = 1;

	unpipe_1 = unpipe;

	function hasPipeDataListeners(stream) {
	  var listeners = stream.listeners('data');

	  for (var i = 0; i < listeners.length; i++) {
	    if (listeners[i].name === 'ondata') {
	      return true
	    }
	  }

	  return false
	}

	function unpipe(stream) {
	  if (!stream) {
	    throw new TypeError('argument stream is required')
	  }

	  if (typeof stream.unpipe === 'function') {
	    // new-style
	    stream.unpipe();
	    return
	  }

	  // Node.js 0.8 hack
	  if (!hasPipeDataListeners(stream)) {
	    return
	  }

	  var listener;
	  var listeners = stream.listeners('close');

	  for (var i = 0; i < listeners.length; i++) {
	    listener = listeners[i];

	    if (listener.name !== 'cleanup' && listener.name !== 'onclose') {
	      continue
	    }

	    // invoke the listener
	    listener.call(stream);
	  }
	}
	return unpipe_1;
}

var rawBody;
var hasRequiredRawBody;

function requireRawBody () {
	if (hasRequiredRawBody) return rawBody;
	hasRequiredRawBody = 1;

	var asyncHooks = tryRequireAsyncHooks();
	var bytes = requireBytes();
	var createError = requireHttpErrors();
	var iconv = requireLib$1();
	var unpipe = requireUnpipe();

	rawBody = getRawBody;

	var ICONV_ENCODING_MESSAGE_REGEXP = /^Encoding not recognized: /;

	function getDecoder (encoding) {
	  if (!encoding) return null

	  try {
	    return iconv.getDecoder(encoding)
	  } catch (e) {
	    // error getting decoder
	    if (!ICONV_ENCODING_MESSAGE_REGEXP.test(e.message)) throw e

	    // the encoding was not found
	    throw createError(415, 'specified encoding unsupported', {
	      encoding: encoding,
	      type: 'encoding.unsupported'
	    })
	  }
	}

	function getRawBody (stream, options, callback) {
	  var done = callback;
	  var opts = options || {};

	  // light validation
	  if (stream === undefined) {
	    throw new TypeError('argument stream is required')
	  } else if (typeof stream !== 'object' || stream === null || typeof stream.on !== 'function') {
	    throw new TypeError('argument stream must be a stream')
	  }

	  if (options === true || typeof options === 'string') {
	    // short cut for encoding
	    opts = {
	      encoding: options
	    };
	  }

	  if (typeof options === 'function') {
	    done = options;
	    opts = {};
	  }

	  // validate callback is a function, if provided
	  if (done !== undefined && typeof done !== 'function') {
	    throw new TypeError('argument callback must be a function')
	  }

	  // require the callback without promises
	  if (!done && !commonjsGlobal.Promise) {
	    throw new TypeError('argument callback is required')
	  }

	  // get encoding
	  var encoding = opts.encoding !== true
	    ? opts.encoding
	    : 'utf-8';

	  // convert the limit to an integer
	  var limit = bytes.parse(opts.limit);

	  // convert the expected length to an integer
	  var length = opts.length != null && !isNaN(opts.length)
	    ? parseInt(opts.length, 10)
	    : null;

	  if (done) {
	    // classic callback style
	    return readStream(stream, encoding, length, limit, wrap(done))
	  }

	  return new Promise(function executor (resolve, reject) {
	    readStream(stream, encoding, length, limit, function onRead (err, buf) {
	      if (err) return reject(err)
	      resolve(buf);
	    });
	  })
	}

	function halt (stream) {
	  // unpipe everything from the stream
	  unpipe(stream);

	  // pause stream
	  if (typeof stream.pause === 'function') {
	    stream.pause();
	  }
	}

	function readStream (stream, encoding, length, limit, callback) {
	  var complete = false;
	  var sync = true;

	  if (limit !== null && length !== null && length > limit) {
	    return done(createError(413, 'request entity too large', {
	      expected: length,
	      length: length,
	      limit: limit,
	      type: 'entity.too.large'
	    }))
	  }

	  var state = stream._readableState;
	  if (stream._decoder || (state && (state.encoding || state.decoder))) {
	    // developer error
	    return done(createError(500, 'stream encoding should not be set', {
	      type: 'stream.encoding.set'
	    }))
	  }

	  if (typeof stream.readable !== 'undefined' && !stream.readable) {
	    return done(createError(500, 'stream is not readable', {
	      type: 'stream.not.readable'
	    }))
	  }

	  var received = 0;
	  var decoder;

	  try {
	    decoder = getDecoder(encoding);
	  } catch (err) {
	    return done(err)
	  }

	  var buffer = decoder
	    ? ''
	    : [];

	  // attach listeners
	  stream.on('aborted', onAborted);
	  stream.on('close', cleanup);
	  stream.on('data', onData);
	  stream.on('end', onEnd);
	  stream.on('error', onEnd);

	  // mark sync section complete
	  sync = false;

	  function done () {
	    var args = new Array(arguments.length);

	    // copy arguments
	    for (var i = 0; i < args.length; i++) {
	      args[i] = arguments[i];
	    }

	    // mark complete
	    complete = true;

	    if (sync) {
	      process.nextTick(invokeCallback);
	    } else {
	      invokeCallback();
	    }

	    function invokeCallback () {
	      cleanup();

	      if (args[0]) {
	        // halt the stream on error
	        halt(stream);
	      }

	      callback.apply(null, args);
	    }
	  }

	  function onAborted () {
	    if (complete) return

	    done(createError(400, 'request aborted', {
	      code: 'ECONNABORTED',
	      expected: length,
	      length: length,
	      received: received,
	      type: 'request.aborted'
	    }));
	  }

	  function onData (chunk) {
	    if (complete) return

	    received += chunk.length;

	    if (limit !== null && received > limit) {
	      done(createError(413, 'request entity too large', {
	        limit: limit,
	        received: received,
	        type: 'entity.too.large'
	      }));
	    } else if (decoder) {
	      buffer += decoder.write(chunk);
	    } else {
	      buffer.push(chunk);
	    }
	  }

	  function onEnd (err) {
	    if (complete) return
	    if (err) return done(err)

	    if (length !== null && received !== length) {
	      done(createError(400, 'request size did not match content length', {
	        expected: length,
	        length: length,
	        received: received,
	        type: 'request.size.invalid'
	      }));
	    } else {
	      var string = decoder
	        ? buffer + (decoder.end() || '')
	        : Buffer.concat(buffer);
	      done(null, string);
	    }
	  }

	  function cleanup () {
	    buffer = null;

	    stream.removeListener('aborted', onAborted);
	    stream.removeListener('data', onData);
	    stream.removeListener('end', onEnd);
	    stream.removeListener('error', onEnd);
	    stream.removeListener('close', cleanup);
	  }
	}

	function tryRequireAsyncHooks () {
	  try {
	    return require('async_hooks')
	  } catch (e) {
	    return {}
	  }
	}

	function wrap (fn) {
	  var res;

	  // create anonymous resource
	  if (asyncHooks.AsyncResource) {
	    res = new asyncHooks.AsyncResource(fn.name || 'bound-anonymous-fn');
	  }

	  // incompatible node.js
	  if (!res || !res.runInAsyncScope) {
	    return fn
	  }

	  // return bound function
	  return res.runInAsyncScope.bind(res, fn, null)
	}
	return rawBody;
}

var onFinished = {exports: {}};

var eeFirst;
var hasRequiredEeFirst;

function requireEeFirst () {
	if (hasRequiredEeFirst) return eeFirst;
	hasRequiredEeFirst = 1;

	eeFirst = first;

	function first(stuff, done) {
	  if (!Array.isArray(stuff))
	    throw new TypeError('arg must be an array of [ee, events...] arrays')

	  var cleanups = [];

	  for (var i = 0; i < stuff.length; i++) {
	    var arr = stuff[i];

	    if (!Array.isArray(arr) || arr.length < 2)
	      throw new TypeError('each array member must be [ee, events...]')

	    var ee = arr[0];

	    for (var j = 1; j < arr.length; j++) {
	      var event = arr[j];
	      var fn = listener(event, callback);

	      // listen to the event
	      ee.on(event, fn);
	      // push this listener to the list of cleanups
	      cleanups.push({
	        ee: ee,
	        event: event,
	        fn: fn,
	      });
	    }
	  }

	  function callback() {
	    cleanup();
	    done.apply(null, arguments);
	  }

	  function cleanup() {
	    var x;
	    for (var i = 0; i < cleanups.length; i++) {
	      x = cleanups[i];
	      x.ee.removeListener(x.event, x.fn);
	    }
	  }

	  function thunk(fn) {
	    done = fn;
	  }

	  thunk.cancel = cleanup;

	  return thunk
	}

	function listener(event, done) {
	  return function onevent(arg1) {
	    var args = new Array(arguments.length);
	    var ee = this;
	    var err = event === 'error'
	      ? arg1
	      : null;

	    // copy args to prevent arguments escaping scope
	    for (var i = 0; i < args.length; i++) {
	      args[i] = arguments[i];
	    }

	    done(err, ee, event, args);
	  }
	}
	return eeFirst;
}

var hasRequiredOnFinished;

function requireOnFinished () {
	if (hasRequiredOnFinished) return onFinished.exports;
	hasRequiredOnFinished = 1;

	onFinished.exports = onFinished$1;
	onFinished.exports.isFinished = isFinished;

	var asyncHooks = tryRequireAsyncHooks();
	var first = requireEeFirst();

	/* istanbul ignore next */
	var defer = typeof setImmediate === 'function'
	  ? setImmediate
	  : function (fn) { process.nextTick(fn.bind.apply(fn, arguments)); };

	function onFinished$1 (msg, listener) {
	  if (isFinished(msg) !== false) {
	    defer(listener, null, msg);
	    return msg
	  }

	  // attach the listener to the message
	  attachListener(msg, wrap(listener));

	  return msg
	}

	function isFinished (msg) {
	  var socket = msg.socket;

	  if (typeof msg.finished === 'boolean') {
	    // OutgoingMessage
	    return Boolean(msg.finished || (socket && !socket.writable))
	  }

	  if (typeof msg.complete === 'boolean') {
	    // IncomingMessage
	    return Boolean(msg.upgrade || !socket || !socket.readable || (msg.complete && !msg.readable))
	  }

	  // don't know
	  return undefined
	}

	function attachFinishedListener (msg, callback) {
	  var eeMsg;
	  var eeSocket;
	  var finished = false;

	  function onFinish (error) {
	    eeMsg.cancel();
	    eeSocket.cancel();

	    finished = true;
	    callback(error);
	  }

	  // finished on first message event
	  eeMsg = eeSocket = first([[msg, 'end', 'finish']], onFinish);

	  function onSocket (socket) {
	    // remove listener
	    msg.removeListener('socket', onSocket);

	    if (finished) return
	    if (eeMsg !== eeSocket) return

	    // finished on first socket event
	    eeSocket = first([[socket, 'error', 'close']], onFinish);
	  }

	  if (msg.socket) {
	    // socket already assigned
	    onSocket(msg.socket);
	    return
	  }

	  // wait for socket to be assigned
	  msg.on('socket', onSocket);

	  if (msg.socket === undefined) {
	    // istanbul ignore next: node.js 0.8 patch
	    patchAssignSocket(msg, onSocket);
	  }
	}

	function attachListener (msg, listener) {
	  var attached = msg.__onFinished;

	  // create a private single listener with queue
	  if (!attached || !attached.queue) {
	    attached = msg.__onFinished = createListener(msg);
	    attachFinishedListener(msg, attached);
	  }

	  attached.queue.push(listener);
	}

	function createListener (msg) {
	  function listener (err) {
	    if (msg.__onFinished === listener) msg.__onFinished = null;
	    if (!listener.queue) return

	    var queue = listener.queue;
	    listener.queue = null;

	    for (var i = 0; i < queue.length; i++) {
	      queue[i](err, msg);
	    }
	  }

	  listener.queue = [];

	  return listener
	}

	// istanbul ignore next: node.js 0.8 patch
	function patchAssignSocket (res, callback) {
	  var assignSocket = res.assignSocket;

	  if (typeof assignSocket !== 'function') return

	  // res.on('socket', callback) is broken in 0.8
	  res.assignSocket = function _assignSocket (socket) {
	    assignSocket.call(this, socket);
	    callback(socket);
	  };
	}

	function tryRequireAsyncHooks () {
	  try {
	    return require('async_hooks')
	  } catch (e) {
	    return {}
	  }
	}

	function wrap (fn) {
	  var res;

	  // create anonymous resource
	  if (asyncHooks.AsyncResource) {
	    res = new asyncHooks.AsyncResource(fn.name || 'bound-anonymous-fn');
	  }

	  // incompatible node.js
	  if (!res || !res.runInAsyncScope) {
	    return fn
	  }

	  // return bound function
	  return res.runInAsyncScope.bind(res, fn, null)
	}
	return onFinished.exports;
}

var read_1;
var hasRequiredRead;

function requireRead () {
	if (hasRequiredRead) return read_1;
	hasRequiredRead = 1;

	var createError = requireHttpErrors();
	var destroy = requireDestroy();
	var getBody = requireRawBody();
	var iconv = requireLib$1();
	var onFinished = requireOnFinished();
	var unpipe = requireUnpipe();
	var zlib = require$$3$2;

	read_1 = read;

	function read (req, res, next, parse, debug, options) {
	  var length;
	  var opts = options;
	  var stream;

	  req._body = true;
	  var encoding = opts.encoding !== null
	    ? opts.encoding
	    : null;
	  var verify = opts.verify;

	  try {
	    stream = contentstream(req, debug, opts.inflate);
	    length = stream.length;
	    stream.length = undefined;
	  } catch (err) {
	    return next(err)
	  }

	  opts.length = length;
	  opts.encoding = verify
	    ? null
	    : encoding;

	  if (opts.encoding === null && encoding !== null && !iconv.encodingExists(encoding)) {
	    return next(createError(415, 'unsupported charset "' + encoding.toUpperCase() + '"', {
	      charset: encoding.toLowerCase(),
	      type: 'charset.unsupported'
	    }))
	  }

	  // read body
	  debug('read body');
	  getBody(stream, opts, function (error, body) {
	    if (error) {
	      var _error;

	      if (error.type === 'encoding.unsupported') {
	        // echo back charset
	        _error = createError(415, 'unsupported charset "' + encoding.toUpperCase() + '"', {
	          charset: encoding.toLowerCase(),
	          type: 'charset.unsupported'
	        });
	      } else {
	        // set status code on error
	        _error = createError(400, error);
	      }

	      // unpipe from stream and destroy
	      if (stream !== req) {
	        unpipe(req);
	        destroy(stream, true);
	      }

	      // read off entire request
	      dump(req, function onfinished () {
	        next(createError(400, _error));
	      });
	      return
	    }

	    // verify
	    if (verify) {
	      try {
	        debug('verify body');
	        verify(req, res, body, encoding);
	      } catch (err) {
	        next(createError(403, err, {
	          body: body,
	          type: err.type || 'entity.verify.failed'
	        }));
	        return
	      }
	    }

	    // parse
	    var str = body;
	    try {
	      debug('parse body');
	      str = typeof body !== 'string' && encoding !== null
	        ? iconv.decode(body, encoding)
	        : body;
	      req.body = parse(str);
	    } catch (err) {
	      next(createError(400, err, {
	        body: str,
	        type: err.type || 'entity.parse.failed'
	      }));
	      return
	    }

	    next();
	  });
	}

	function contentstream (req, debug, inflate) {
	  var encoding = (req.headers['content-encoding'] || 'identity').toLowerCase();
	  var length = req.headers['content-length'];
	  var stream;

	  debug('content-encoding "%s"', encoding);

	  if (inflate === false && encoding !== 'identity') {
	    throw createError(415, 'content encoding unsupported', {
	      encoding: encoding,
	      type: 'encoding.unsupported'
	    })
	  }

	  switch (encoding) {
	    case 'deflate':
	      stream = zlib.createInflate();
	      debug('inflate body');
	      req.pipe(stream);
	      break
	    case 'gzip':
	      stream = zlib.createGunzip();
	      debug('gunzip body');
	      req.pipe(stream);
	      break
	    case 'identity':
	      stream = req;
	      stream.length = length;
	      break
	    default:
	      throw createError(415, 'unsupported content encoding "' + encoding + '"', {
	        encoding: encoding,
	        type: 'encoding.unsupported'
	      })
	  }

	  return stream
	}

	function dump (req, callback) {
	  if (onFinished.isFinished(req)) {
	    callback(null);
	  } else {
	    onFinished(req, callback);
	    req.resume();
	  }
	}
	return read_1;
}

var typeIs = {exports: {}};

var mediaTyper = {};

var hasRequiredMediaTyper;

function requireMediaTyper () {
	if (hasRequiredMediaTyper) return mediaTyper;
	hasRequiredMediaTyper = 1;
	var paramRegExp = /; *([!#$%&'\*\+\-\.0-9A-Z\^_`a-z\|~]+) *= *("(?:[ !\u0023-\u005b\u005d-\u007e\u0080-\u00ff]|\\[\u0020-\u007e])*"|[!#$%&'\*\+\-\.0-9A-Z\^_`a-z\|~]+) */g;
	var textRegExp = /^[\u0020-\u007e\u0080-\u00ff]+$/;
	var tokenRegExp = /^[!#$%&'\*\+\-\.0-9A-Z\^_`a-z\|~]+$/;

	var qescRegExp = /\\([\u0000-\u007f])/g;
	var quoteRegExp = /([\\"])/g;

	var subtypeNameRegExp = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.-]{0,126}$/;
	var typeNameRegExp = /^[A-Za-z0-9][A-Za-z0-9!#$&^_-]{0,126}$/;
	var typeRegExp = /^ *([A-Za-z0-9][A-Za-z0-9!#$&^_-]{0,126})\/([A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}) *$/;


	mediaTyper.format = format;
	mediaTyper.parse = parse;

	function format(obj) {
	  if (!obj || typeof obj !== 'object') {
	    throw new TypeError('argument obj is required')
	  }

	  var parameters = obj.parameters;
	  var subtype = obj.subtype;
	  var suffix = obj.suffix;
	  var type = obj.type;

	  if (!type || !typeNameRegExp.test(type)) {
	    throw new TypeError('invalid type')
	  }

	  if (!subtype || !subtypeNameRegExp.test(subtype)) {
	    throw new TypeError('invalid subtype')
	  }

	  // format as type/subtype
	  var string = type + '/' + subtype;

	  // append +suffix
	  if (suffix) {
	    if (!typeNameRegExp.test(suffix)) {
	      throw new TypeError('invalid suffix')
	    }

	    string += '+' + suffix;
	  }

	  // append parameters
	  if (parameters && typeof parameters === 'object') {
	    var param;
	    var params = Object.keys(parameters).sort();

	    for (var i = 0; i < params.length; i++) {
	      param = params[i];

	      if (!tokenRegExp.test(param)) {
	        throw new TypeError('invalid parameter name')
	      }

	      string += '; ' + param + '=' + qstring(parameters[param]);
	    }
	  }

	  return string
	}

	function parse(string) {
	  if (!string) {
	    throw new TypeError('argument string is required')
	  }

	  // support req/res-like objects as argument
	  if (typeof string === 'object') {
	    string = getcontenttype(string);
	  }

	  if (typeof string !== 'string') {
	    throw new TypeError('argument string is required to be a string')
	  }

	  var index = string.indexOf(';');
	  var type = index !== -1
	    ? string.substr(0, index)
	    : string;

	  var key;
	  var match;
	  var obj = splitType(type);
	  var params = {};
	  var value;

	  paramRegExp.lastIndex = index;

	  while (match = paramRegExp.exec(string)) {
	    if (match.index !== index) {
	      throw new TypeError('invalid parameter format')
	    }

	    index += match[0].length;
	    key = match[1].toLowerCase();
	    value = match[2];

	    if (value[0] === '"') {
	      // remove quotes and escapes
	      value = value
	        .substr(1, value.length - 2)
	        .replace(qescRegExp, '$1');
	    }

	    params[key] = value;
	  }

	  if (index !== -1 && index !== string.length) {
	    throw new TypeError('invalid parameter format')
	  }

	  obj.parameters = params;

	  return obj
	}

	function getcontenttype(obj) {
	  if (typeof obj.getHeader === 'function') {
	    // res-like
	    return obj.getHeader('content-type')
	  }

	  if (typeof obj.headers === 'object') {
	    // req-like
	    return obj.headers && obj.headers['content-type']
	  }
	}

	function qstring(val) {
	  var str = String(val);

	  // no need to quote tokens
	  if (tokenRegExp.test(str)) {
	    return str
	  }

	  if (str.length > 0 && !textRegExp.test(str)) {
	    throw new TypeError('invalid parameter value')
	  }

	  return '"' + str.replace(quoteRegExp, '\\$1') + '"'
	}


	function splitType(string) {
	  var match = typeRegExp.exec(string.toLowerCase());

	  if (!match) {
	    throw new TypeError('invalid media type')
	  }

	  var type = match[1];
	  var subtype = match[2];
	  var suffix;

	  // suffix after last +
	  var index = subtype.lastIndexOf('+');
	  if (index !== -1) {
	    suffix = subtype.substr(index + 1);
	    subtype = subtype.substr(0, index);
	  }

	  var obj = {
	    type: type,
	    subtype: subtype,
	    suffix: suffix
	  };

	  return obj
	}
	return mediaTyper;
}

var hasRequiredTypeIs;

function requireTypeIs () {
	if (hasRequiredTypeIs) return typeIs.exports;
	hasRequiredTypeIs = 1;


	var typer = requireMediaTyper();
	var mime = requireMimeTypes();


	typeIs.exports = typeofrequest;
	typeIs.exports.is = typeis;
	typeIs.exports.hasBody = hasbody;
	typeIs.exports.normalize = normalize;
	typeIs.exports.match = mimeMatch;

	function typeis (value, types_) {
	  var i;
	  var types = types_;

	  // remove parameters and normalize
	  var val = tryNormalizeType(value);

	  // no type or invalid
	  if (!val) {
	    return false
	  }

	  // support flattened arguments
	  if (types && !Array.isArray(types)) {
	    types = new Array(arguments.length - 1);
	    for (i = 0; i < types.length; i++) {
	      types[i] = arguments[i + 1];
	    }
	  }

	  // no types, return the content type
	  if (!types || !types.length) {
	    return val
	  }

	  var type;
	  for (i = 0; i < types.length; i++) {
	    if (mimeMatch(normalize(type = types[i]), val)) {
	      return type[0] === '+' || type.indexOf('*') !== -1
	        ? val
	        : type
	    }
	  }

	  // no matches
	  return false
	}

	function hasbody (req) {
	  return req.headers['transfer-encoding'] !== undefined ||
	    !isNaN(req.headers['content-length'])
	}

	function typeofrequest (req, types_) {
	  var types = types_;

	  // no body
	  if (!hasbody(req)) {
	    return null
	  }

	  // support flattened arguments
	  if (arguments.length > 2) {
	    types = new Array(arguments.length - 1);
	    for (var i = 0; i < types.length; i++) {
	      types[i] = arguments[i + 1];
	    }
	  }

	  // request content type
	  var value = req.headers['content-type'];

	  return typeis(value, types)
	}

	function normalize (type) {
	  if (typeof type !== 'string') {
	    // invalid type
	    return false
	  }

	  switch (type) {
	    case 'urlencoded':
	      return 'application/x-www-form-urlencoded'
	    case 'multipart':
	      return 'multipart/*'
	  }

	  if (type[0] === '+') {
	    // "+json" -> "*/*+json" expando
	    return '*/*' + type
	  }

	  return type.indexOf('/') === -1
	    ? mime.lookup(type)
	    : type
	}

	function mimeMatch (expected, actual) {
	  // invalid type
	  if (expected === false) {
	    return false
	  }

	  // split types
	  var actualParts = actual.split('/');
	  var expectedParts = expected.split('/');

	  // invalid format
	  if (actualParts.length !== 2 || expectedParts.length !== 2) {
	    return false
	  }

	  // validate type
	  if (expectedParts[0] !== '*' && expectedParts[0] !== actualParts[0]) {
	    return false
	  }

	  // validate suffix wildcard
	  if (expectedParts[1].substr(0, 2) === '*+') {
	    return expectedParts[1].length <= actualParts[1].length + 1 &&
	      expectedParts[1].substr(1) === actualParts[1].substr(1 - expectedParts[1].length)
	  }

	  // validate subtype
	  if (expectedParts[1] !== '*' && expectedParts[1] !== actualParts[1]) {
	    return false
	  }

	  return true
	}

	function normalizeType (value) {
	  // parse the type
	  var type = typer.parse(value);

	  // remove the parameters
	  type.parameters = undefined;

	  // reformat it
	  return typer.format(type)
	}

	function tryNormalizeType (value) {
	  if (!value) {
	    return null
	  }

	  try {
	    return normalizeType(value)
	  } catch (err) {
	    return null
	  }
	}
	return typeIs.exports;
}

var json_1;
var hasRequiredJson;

function requireJson () {
	if (hasRequiredJson) return json_1;
	hasRequiredJson = 1;


	var bytes = requireBytes();
	var contentType = requireContentType();
	var createError = requireHttpErrors();
	var debug = requireSrc()('body-parser:json');
	var read = requireRead();
	var typeis = requireTypeIs();

	json_1 = json;


	var FIRST_CHAR_REGEXP = /^[\x20\x09\x0a\x0d]*([^\x20\x09\x0a\x0d])/; // eslint-disable-line no-control-regex

	var JSON_SYNTAX_CHAR = '#';
	var JSON_SYNTAX_REGEXP = /#+/g;

	function json (options) {
	  var opts = options || {};

	  var limit = typeof opts.limit !== 'number'
	    ? bytes.parse(opts.limit || '100kb')
	    : opts.limit;
	  var inflate = opts.inflate !== false;
	  var reviver = opts.reviver;
	  var strict = opts.strict !== false;
	  var type = opts.type || 'application/json';
	  var verify = opts.verify || false;

	  if (verify !== false && typeof verify !== 'function') {
	    throw new TypeError('option verify must be function')
	  }

	  // create the appropriate type checking function
	  var shouldParse = typeof type !== 'function'
	    ? typeChecker(type)
	    : type;

	  function parse (body) {
	    if (body.length === 0) {
	      return {}
	    }

	    if (strict) {
	      var first = firstchar(body);

	      if (first !== '{' && first !== '[') {
	        debug('strict violation');
	        throw createStrictSyntaxError(body, first)
	      }
	    }

	    try {
	      debug('parse json');
	      return JSON.parse(body, reviver)
	    } catch (e) {
	      throw normalizeJsonSyntaxError(e, {
	        message: e.message,
	        stack: e.stack
	      })
	    }
	  }

	  return function jsonParser (req, res, next) {
	    if (req._body) {
	      debug('body already parsed');
	      next();
	      return
	    }

	    req.body = req.body || {};

	    // skip requests without bodies
	    if (!typeis.hasBody(req)) {
	      debug('skip empty body');
	      next();
	      return
	    }

	    debug('content-type %j', req.headers['content-type']);

	    // determine if request should be parsed
	    if (!shouldParse(req)) {
	      debug('skip parsing');
	      next();
	      return
	    }

	    // assert charset per RFC 7159 sec 8.1
	    var charset = getCharset(req) || 'utf-8';
	    if (charset.slice(0, 4) !== 'utf-') {
	      debug('invalid charset');
	      next(createError(415, 'unsupported charset "' + charset.toUpperCase() + '"', {
	        charset: charset,
	        type: 'charset.unsupported'
	      }));
	      return
	    }

	    // read
	    read(req, res, next, parse, debug, {
	      encoding: charset,
	      inflate: inflate,
	      limit: limit,
	      verify: verify
	    });
	  }
	}

	function createStrictSyntaxError (str, char) {
	  var index = str.indexOf(char);
	  var partial = '';

	  if (index !== -1) {
	    partial = str.substring(0, index) + JSON_SYNTAX_CHAR;

	    for (var i = index + 1; i < str.length; i++) {
	      partial += JSON_SYNTAX_CHAR;
	    }
	  }

	  try {
	    JSON.parse(partial); /* istanbul ignore next */ throw new SyntaxError('strict violation')
	  } catch (e) {
	    return normalizeJsonSyntaxError(e, {
	      message: e.message.replace(JSON_SYNTAX_REGEXP, function (placeholder) {
	        return str.substring(index, index + placeholder.length)
	      }),
	      stack: e.stack
	    })
	  }
	}

	function firstchar (str) {
	  var match = FIRST_CHAR_REGEXP.exec(str);

	  return match
	    ? match[1]
	    : undefined
	}

	function getCharset (req) {
	  try {
	    return (contentType.parse(req).parameters.charset || '').toLowerCase()
	  } catch (e) {
	    return undefined
	  }
	}

	function normalizeJsonSyntaxError (error, obj) {
	  var keys = Object.getOwnPropertyNames(error);

	  for (var i = 0; i < keys.length; i++) {
	    var key = keys[i];
	    if (key !== 'stack' && key !== 'message') {
	      delete error[key];
	    }
	  }

	  // replace stack before message for Node.js 0.10 and below
	  error.stack = obj.stack.replace(error.message, obj.message);
	  error.message = obj.message;

	  return error
	}

	function typeChecker (type) {
	  return function checkType (req) {
	    return Boolean(typeis(req, type))
	  }
	}
	return json_1;
}

var raw_1;
var hasRequiredRaw;

function requireRaw () {
	if (hasRequiredRaw) return raw_1;
	hasRequiredRaw = 1;

	var bytes = requireBytes();
	var debug = requireSrc()('body-parser:raw');
	var read = requireRead();
	var typeis = requireTypeIs();

	raw_1 = raw;

	function raw (options) {
	  var opts = options || {};

	  var inflate = opts.inflate !== false;
	  var limit = typeof opts.limit !== 'number'
	    ? bytes.parse(opts.limit || '100kb')
	    : opts.limit;
	  var type = opts.type || 'application/octet-stream';
	  var verify = opts.verify || false;

	  if (verify !== false && typeof verify !== 'function') {
	    throw new TypeError('option verify must be function')
	  }

	  // create the appropriate type checking function
	  var shouldParse = typeof type !== 'function'
	    ? typeChecker(type)
	    : type;

	  function parse (buf) {
	    return buf
	  }

	  return function rawParser (req, res, next) {
	    if (req._body) {
	      debug('body already parsed');
	      next();
	      return
	    }

	    req.body = req.body || {};

	    // skip requests without bodies
	    if (!typeis.hasBody(req)) {
	      debug('skip empty body');
	      next();
	      return
	    }

	    debug('content-type %j', req.headers['content-type']);

	    // determine if request should be parsed
	    if (!shouldParse(req)) {
	      debug('skip parsing');
	      next();
	      return
	    }

	    // read
	    read(req, res, next, parse, debug, {
	      encoding: null,
	      inflate: inflate,
	      limit: limit,
	      verify: verify
	    });
	  }
	}

	function typeChecker (type) {
	  return function checkType (req) {
	    return Boolean(typeis(req, type))
	  }
	}
	return raw_1;
}

var text_1;
var hasRequiredText;

function requireText () {
	if (hasRequiredText) return text_1;
	hasRequiredText = 1;

	var bytes = requireBytes();
	var contentType = requireContentType();
	var debug = requireSrc()('body-parser:text');
	var read = requireRead();
	var typeis = requireTypeIs();

	text_1 = text;

	function text (options) {
	  var opts = options || {};

	  var defaultCharset = opts.defaultCharset || 'utf-8';
	  var inflate = opts.inflate !== false;
	  var limit = typeof opts.limit !== 'number'
	    ? bytes.parse(opts.limit || '100kb')
	    : opts.limit;
	  var type = opts.type || 'text/plain';
	  var verify = opts.verify || false;

	  if (verify !== false && typeof verify !== 'function') {
	    throw new TypeError('option verify must be function')
	  }

	  // create the appropriate type checking function
	  var shouldParse = typeof type !== 'function'
	    ? typeChecker(type)
	    : type;

	  function parse (buf) {
	    return buf
	  }

	  return function textParser (req, res, next) {
	    if (req._body) {
	      debug('body already parsed');
	      next();
	      return
	    }

	    req.body = req.body || {};

	    // skip requests without bodies
	    if (!typeis.hasBody(req)) {
	      debug('skip empty body');
	      next();
	      return
	    }

	    debug('content-type %j', req.headers['content-type']);

	    // determine if request should be parsed
	    if (!shouldParse(req)) {
	      debug('skip parsing');
	      next();
	      return
	    }

	    // get charset
	    var charset = getCharset(req) || defaultCharset;

	    // read
	    read(req, res, next, parse, debug, {
	      encoding: charset,
	      inflate: inflate,
	      limit: limit,
	      verify: verify
	    });
	  }
	}

	function getCharset (req) {
	  try {
	    return (contentType.parse(req).parameters.charset || '').toLowerCase()
	  } catch (e) {
	    return undefined
	  }
	}

	function typeChecker (type) {
	  return function checkType (req) {
	    return Boolean(typeis(req, type))
	  }
	}
	return text_1;
}

var esErrors;
var hasRequiredEsErrors;

function requireEsErrors () {
	if (hasRequiredEsErrors) return esErrors;
	hasRequiredEsErrors = 1;

	/** @type {import('.')} */
	esErrors = Error;
	return esErrors;
}

var _eval;
var hasRequired_eval;

function require_eval () {
	if (hasRequired_eval) return _eval;
	hasRequired_eval = 1;

	/** @type {import('./eval')} */
	_eval = EvalError;
	return _eval;
}

var range;
var hasRequiredRange;

function requireRange () {
	if (hasRequiredRange) return range;
	hasRequiredRange = 1;

	/** @type {import('./range')} */
	range = RangeError;
	return range;
}

var ref;
var hasRequiredRef;

function requireRef () {
	if (hasRequiredRef) return ref;
	hasRequiredRef = 1;

	/** @type {import('./ref')} */
	ref = ReferenceError;
	return ref;
}

var syntax;
var hasRequiredSyntax;

function requireSyntax () {
	if (hasRequiredSyntax) return syntax;
	hasRequiredSyntax = 1;

	/** @type {import('./syntax')} */
	syntax = SyntaxError;
	return syntax;
}

var type;
var hasRequiredType;

function requireType () {
	if (hasRequiredType) return type;
	hasRequiredType = 1;
	type = TypeError;
	return type;
}

var uri;
var hasRequiredUri;

function requireUri () {
	if (hasRequiredUri) return uri;
	hasRequiredUri = 1;
	uri = URIError;
	return uri;
}

var shams;
var hasRequiredShams;

function requireShams () {
	if (hasRequiredShams) return shams;
	hasRequiredShams = 1;

	/* eslint complexity: [2, 18], max-statements: [2, 33] */
	shams = function hasSymbols() {
		if (typeof Symbol !== 'function' || typeof Object.getOwnPropertySymbols !== 'function') { return false; }
		if (typeof Symbol.iterator === 'symbol') { return true; }

		var obj = {};
		var sym = Symbol('test');
		var symObj = Object(sym);
		if (typeof sym === 'string') { return false; }

		if (Object.prototype.toString.call(sym) !== '[object Symbol]') { return false; }
		if (Object.prototype.toString.call(symObj) !== '[object Symbol]') { return false; }

		var symVal = 42;
		obj[sym] = symVal;
		for (sym in obj) { return false; } // eslint-disable-line no-restricted-syntax, no-unreachable-loop
		if (typeof Object.keys === 'function' && Object.keys(obj).length !== 0) { return false; }

		if (typeof Object.getOwnPropertyNames === 'function' && Object.getOwnPropertyNames(obj).length !== 0) { return false; }

		var syms = Object.getOwnPropertySymbols(obj);
		if (syms.length !== 1 || syms[0] !== sym) { return false; }

		if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) { return false; }

		if (typeof Object.getOwnPropertyDescriptor === 'function') {
			var descriptor = Object.getOwnPropertyDescriptor(obj, sym);
			if (descriptor.value !== symVal || descriptor.enumerable !== true) { return false; }
		}

		return true;
	};
	return shams;
}

var hasSymbols;
var hasRequiredHasSymbols;

function requireHasSymbols () {
	if (hasRequiredHasSymbols) return hasSymbols;
	hasRequiredHasSymbols = 1;

	var origSymbol = typeof Symbol !== 'undefined' && Symbol;
	var hasSymbolSham = requireShams();

	hasSymbols = function hasNativeSymbols() {
		if (typeof origSymbol !== 'function') { return false; }
		if (typeof Symbol !== 'function') { return false; }
		if (typeof origSymbol('foo') !== 'symbol') { return false; }
		if (typeof Symbol('bar') !== 'symbol') { return false; }

		return hasSymbolSham();
	};
	return hasSymbols;
}

var hasProto;
var hasRequiredHasProto;

function requireHasProto () {
	if (hasRequiredHasProto) return hasProto;
	hasRequiredHasProto = 1;

	var test = {
		__proto__: null,
		foo: {}
	};

	var $Object = Object;

	/** @type {import('.')} */
	hasProto = function hasProto() {
		// @ts-expect-error: TS errors on an inherited property for some reason
		return { __proto__: test }.foo === test.foo
			&& !(test instanceof $Object);
	};
	return hasProto;
}

var implementation;
var hasRequiredImplementation;

function requireImplementation () {
	if (hasRequiredImplementation) return implementation;
	hasRequiredImplementation = 1;

	/* eslint no-invalid-this: 1 */

	var ERROR_MESSAGE = 'Function.prototype.bind called on incompatible ';
	var toStr = Object.prototype.toString;
	var max = Math.max;
	var funcType = '[object Function]';

	var concatty = function concatty(a, b) {
	    var arr = [];

	    for (var i = 0; i < a.length; i += 1) {
	        arr[i] = a[i];
	    }
	    for (var j = 0; j < b.length; j += 1) {
	        arr[j + a.length] = b[j];
	    }

	    return arr;
	};

	var slicy = function slicy(arrLike, offset) {
	    var arr = [];
	    for (var i = offset , j = 0; i < arrLike.length; i += 1, j += 1) {
	        arr[j] = arrLike[i];
	    }
	    return arr;
	};

	var joiny = function (arr, joiner) {
	    var str = '';
	    for (var i = 0; i < arr.length; i += 1) {
	        str += arr[i];
	        if (i + 1 < arr.length) {
	            str += joiner;
	        }
	    }
	    return str;
	};

	implementation = function bind(that) {
	    var target = this;
	    if (typeof target !== 'function' || toStr.apply(target) !== funcType) {
	        throw new TypeError(ERROR_MESSAGE + target);
	    }
	    var args = slicy(arguments, 1);

	    var bound;
	    var binder = function () {
	        if (this instanceof bound) {
	            var result = target.apply(
	                this,
	                concatty(args, arguments)
	            );
	            if (Object(result) === result) {
	                return result;
	            }
	            return this;
	        }
	        return target.apply(
	            that,
	            concatty(args, arguments)
	        );

	    };

	    var boundLength = max(0, target.length - args.length);
	    var boundArgs = [];
	    for (var i = 0; i < boundLength; i++) {
	        boundArgs[i] = '$' + i;
	    }

	    bound = Function('binder', 'return function (' + joiny(boundArgs, ',') + '){ return binder.apply(this,arguments); }')(binder);

	    if (target.prototype) {
	        var Empty = function Empty() {};
	        Empty.prototype = target.prototype;
	        bound.prototype = new Empty();
	        Empty.prototype = null;
	    }

	    return bound;
	};
	return implementation;
}

var functionBind;
var hasRequiredFunctionBind;

function requireFunctionBind () {
	if (hasRequiredFunctionBind) return functionBind;
	hasRequiredFunctionBind = 1;

	var implementation = requireImplementation();

	functionBind = Function.prototype.bind || implementation;
	return functionBind;
}

var hasown;
var hasRequiredHasown;

function requireHasown () {
	if (hasRequiredHasown) return hasown;
	hasRequiredHasown = 1;

	var call = Function.prototype.call;
	var $hasOwn = Object.prototype.hasOwnProperty;
	var bind = requireFunctionBind();

	hasown = bind.call(call, $hasOwn);
	return hasown;
}

var getIntrinsic;
var hasRequiredGetIntrinsic;

function requireGetIntrinsic () {
	if (hasRequiredGetIntrinsic) return getIntrinsic;
	hasRequiredGetIntrinsic = 1;

	var undefined$1;

	var $Error = requireEsErrors();
	var $EvalError = require_eval();
	var $RangeError = requireRange();
	var $ReferenceError = requireRef();
	var $SyntaxError = requireSyntax();
	var $TypeError = requireType();
	var $URIError = requireUri();

	var $Function = Function;

	// eslint-disable-next-line consistent-return
	var getEvalledConstructor = function (expressionSyntax) {
		try {
			return $Function('"use strict"; return (' + expressionSyntax + ').constructor;')();
		} catch (e) {}
	};

	var $gOPD = Object.getOwnPropertyDescriptor;
	if ($gOPD) {
		try {
			$gOPD({}, '');
		} catch (e) {
			$gOPD = null; // this is IE 8, which has a broken gOPD
		}
	}

	var throwTypeError = function () {
		throw new $TypeError();
	};
	var ThrowTypeError = $gOPD
		? (function () {
			try {
				arguments.callee; // IE 8 does not throw here
				return throwTypeError;
			} catch (calleeThrows) {
				try {
					return $gOPD(arguments, 'callee').get;
				} catch (gOPDthrows) {
					return throwTypeError;
				}
			}
		}())
		: throwTypeError;

	var hasSymbols = requireHasSymbols()();
	var hasProto = requireHasProto()();

	var getProto = Object.getPrototypeOf || (
		hasProto
			? function (x) { return x.__proto__; } // eslint-disable-line no-proto
			: null
	);

	var needsEval = {};

	var TypedArray = typeof Uint8Array === 'undefined' || !getProto ? undefined$1 : getProto(Uint8Array);

	var INTRINSICS = {
		__proto__: null,
		'%AggregateError%': typeof AggregateError === 'undefined' ? undefined$1 : AggregateError,
		'%Array%': Array,
		'%ArrayBuffer%': typeof ArrayBuffer === 'undefined' ? undefined$1 : ArrayBuffer,
		'%ArrayIteratorPrototype%': hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined$1,
		'%AsyncFromSyncIteratorPrototype%': undefined$1,
		'%AsyncFunction%': needsEval,
		'%AsyncGenerator%': needsEval,
		'%AsyncGeneratorFunction%': needsEval,
		'%AsyncIteratorPrototype%': needsEval,
		'%Atomics%': typeof Atomics === 'undefined' ? undefined$1 : Atomics,
		'%BigInt%': typeof BigInt === 'undefined' ? undefined$1 : BigInt,
		'%BigInt64Array%': typeof BigInt64Array === 'undefined' ? undefined$1 : BigInt64Array,
		'%BigUint64Array%': typeof BigUint64Array === 'undefined' ? undefined$1 : BigUint64Array,
		'%Boolean%': Boolean,
		'%DataView%': typeof DataView === 'undefined' ? undefined$1 : DataView,
		'%Date%': Date,
		'%decodeURI%': decodeURI,
		'%decodeURIComponent%': decodeURIComponent,
		'%encodeURI%': encodeURI,
		'%encodeURIComponent%': encodeURIComponent,
		'%Error%': $Error,
		'%eval%': eval, // eslint-disable-line no-eval
		'%EvalError%': $EvalError,
		'%Float32Array%': typeof Float32Array === 'undefined' ? undefined$1 : Float32Array,
		'%Float64Array%': typeof Float64Array === 'undefined' ? undefined$1 : Float64Array,
		'%FinalizationRegistry%': typeof FinalizationRegistry === 'undefined' ? undefined$1 : FinalizationRegistry,
		'%Function%': $Function,
		'%GeneratorFunction%': needsEval,
		'%Int8Array%': typeof Int8Array === 'undefined' ? undefined$1 : Int8Array,
		'%Int16Array%': typeof Int16Array === 'undefined' ? undefined$1 : Int16Array,
		'%Int32Array%': typeof Int32Array === 'undefined' ? undefined$1 : Int32Array,
		'%isFinite%': isFinite,
		'%isNaN%': isNaN,
		'%IteratorPrototype%': hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined$1,
		'%JSON%': typeof JSON === 'object' ? JSON : undefined$1,
		'%Map%': typeof Map === 'undefined' ? undefined$1 : Map,
		'%MapIteratorPrototype%': typeof Map === 'undefined' || !hasSymbols || !getProto ? undefined$1 : getProto(new Map()[Symbol.iterator]()),
		'%Math%': Math,
		'%Number%': Number,
		'%Object%': Object,
		'%parseFloat%': parseFloat,
		'%parseInt%': parseInt,
		'%Promise%': typeof Promise === 'undefined' ? undefined$1 : Promise,
		'%Proxy%': typeof Proxy === 'undefined' ? undefined$1 : Proxy,
		'%RangeError%': $RangeError,
		'%ReferenceError%': $ReferenceError,
		'%Reflect%': typeof Reflect === 'undefined' ? undefined$1 : Reflect,
		'%RegExp%': RegExp,
		'%Set%': typeof Set === 'undefined' ? undefined$1 : Set,
		'%SetIteratorPrototype%': typeof Set === 'undefined' || !hasSymbols || !getProto ? undefined$1 : getProto(new Set()[Symbol.iterator]()),
		'%SharedArrayBuffer%': typeof SharedArrayBuffer === 'undefined' ? undefined$1 : SharedArrayBuffer,
		'%String%': String,
		'%StringIteratorPrototype%': hasSymbols && getProto ? getProto(''[Symbol.iterator]()) : undefined$1,
		'%Symbol%': hasSymbols ? Symbol : undefined$1,
		'%SyntaxError%': $SyntaxError,
		'%ThrowTypeError%': ThrowTypeError,
		'%TypedArray%': TypedArray,
		'%TypeError%': $TypeError,
		'%Uint8Array%': typeof Uint8Array === 'undefined' ? undefined$1 : Uint8Array,
		'%Uint8ClampedArray%': typeof Uint8ClampedArray === 'undefined' ? undefined$1 : Uint8ClampedArray,
		'%Uint16Array%': typeof Uint16Array === 'undefined' ? undefined$1 : Uint16Array,
		'%Uint32Array%': typeof Uint32Array === 'undefined' ? undefined$1 : Uint32Array,
		'%URIError%': $URIError,
		'%WeakMap%': typeof WeakMap === 'undefined' ? undefined$1 : WeakMap,
		'%WeakRef%': typeof WeakRef === 'undefined' ? undefined$1 : WeakRef,
		'%WeakSet%': typeof WeakSet === 'undefined' ? undefined$1 : WeakSet
	};

	if (getProto) {
		try {
			null.error; // eslint-disable-line no-unused-expressions
		} catch (e) {
			// https://github.com/tc39/proposal-shadowrealm/pull/384#issuecomment-1364264229
			var errorProto = getProto(getProto(e));
			INTRINSICS['%Error.prototype%'] = errorProto;
		}
	}

	var doEval = function doEval(name) {
		var value;
		if (name === '%AsyncFunction%') {
			value = getEvalledConstructor('async function () {}');
		} else if (name === '%GeneratorFunction%') {
			value = getEvalledConstructor('function* () {}');
		} else if (name === '%AsyncGeneratorFunction%') {
			value = getEvalledConstructor('async function* () {}');
		} else if (name === '%AsyncGenerator%') {
			var fn = doEval('%AsyncGeneratorFunction%');
			if (fn) {
				value = fn.prototype;
			}
		} else if (name === '%AsyncIteratorPrototype%') {
			var gen = doEval('%AsyncGenerator%');
			if (gen && getProto) {
				value = getProto(gen.prototype);
			}
		}

		INTRINSICS[name] = value;

		return value;
	};

	var LEGACY_ALIASES = {
		__proto__: null,
		'%ArrayBufferPrototype%': ['ArrayBuffer', 'prototype'],
		'%ArrayPrototype%': ['Array', 'prototype'],
		'%ArrayProto_entries%': ['Array', 'prototype', 'entries'],
		'%ArrayProto_forEach%': ['Array', 'prototype', 'forEach'],
		'%ArrayProto_keys%': ['Array', 'prototype', 'keys'],
		'%ArrayProto_values%': ['Array', 'prototype', 'values'],
		'%AsyncFunctionPrototype%': ['AsyncFunction', 'prototype'],
		'%AsyncGenerator%': ['AsyncGeneratorFunction', 'prototype'],
		'%AsyncGeneratorPrototype%': ['AsyncGeneratorFunction', 'prototype', 'prototype'],
		'%BooleanPrototype%': ['Boolean', 'prototype'],
		'%DataViewPrototype%': ['DataView', 'prototype'],
		'%DatePrototype%': ['Date', 'prototype'],
		'%ErrorPrototype%': ['Error', 'prototype'],
		'%EvalErrorPrototype%': ['EvalError', 'prototype'],
		'%Float32ArrayPrototype%': ['Float32Array', 'prototype'],
		'%Float64ArrayPrototype%': ['Float64Array', 'prototype'],
		'%FunctionPrototype%': ['Function', 'prototype'],
		'%Generator%': ['GeneratorFunction', 'prototype'],
		'%GeneratorPrototype%': ['GeneratorFunction', 'prototype', 'prototype'],
		'%Int8ArrayPrototype%': ['Int8Array', 'prototype'],
		'%Int16ArrayPrototype%': ['Int16Array', 'prototype'],
		'%Int32ArrayPrototype%': ['Int32Array', 'prototype'],
		'%JSONParse%': ['JSON', 'parse'],
		'%JSONStringify%': ['JSON', 'stringify'],
		'%MapPrototype%': ['Map', 'prototype'],
		'%NumberPrototype%': ['Number', 'prototype'],
		'%ObjectPrototype%': ['Object', 'prototype'],
		'%ObjProto_toString%': ['Object', 'prototype', 'toString'],
		'%ObjProto_valueOf%': ['Object', 'prototype', 'valueOf'],
		'%PromisePrototype%': ['Promise', 'prototype'],
		'%PromiseProto_then%': ['Promise', 'prototype', 'then'],
		'%Promise_all%': ['Promise', 'all'],
		'%Promise_reject%': ['Promise', 'reject'],
		'%Promise_resolve%': ['Promise', 'resolve'],
		'%RangeErrorPrototype%': ['RangeError', 'prototype'],
		'%ReferenceErrorPrototype%': ['ReferenceError', 'prototype'],
		'%RegExpPrototype%': ['RegExp', 'prototype'],
		'%SetPrototype%': ['Set', 'prototype'],
		'%SharedArrayBufferPrototype%': ['SharedArrayBuffer', 'prototype'],
		'%StringPrototype%': ['String', 'prototype'],
		'%SymbolPrototype%': ['Symbol', 'prototype'],
		'%SyntaxErrorPrototype%': ['SyntaxError', 'prototype'],
		'%TypedArrayPrototype%': ['TypedArray', 'prototype'],
		'%TypeErrorPrototype%': ['TypeError', 'prototype'],
		'%Uint8ArrayPrototype%': ['Uint8Array', 'prototype'],
		'%Uint8ClampedArrayPrototype%': ['Uint8ClampedArray', 'prototype'],
		'%Uint16ArrayPrototype%': ['Uint16Array', 'prototype'],
		'%Uint32ArrayPrototype%': ['Uint32Array', 'prototype'],
		'%URIErrorPrototype%': ['URIError', 'prototype'],
		'%WeakMapPrototype%': ['WeakMap', 'prototype'],
		'%WeakSetPrototype%': ['WeakSet', 'prototype']
	};

	var bind = requireFunctionBind();
	var hasOwn = requireHasown();
	var $concat = bind.call(Function.call, Array.prototype.concat);
	var $spliceApply = bind.call(Function.apply, Array.prototype.splice);
	var $replace = bind.call(Function.call, String.prototype.replace);
	var $strSlice = bind.call(Function.call, String.prototype.slice);
	var $exec = bind.call(Function.call, RegExp.prototype.exec);

	/* adapted from https://github.com/lodash/lodash/blob/4.17.15/dist/lodash.js#L6735-L6744 */
	var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
	var reEscapeChar = /\\(\\)?/g; /** Used to match backslashes in property paths. */
	var stringToPath = function stringToPath(string) {
		var first = $strSlice(string, 0, 1);
		var last = $strSlice(string, -1);
		if (first === '%' && last !== '%') {
			throw new $SyntaxError('invalid intrinsic syntax, expected closing `%`');
		} else if (last === '%' && first !== '%') {
			throw new $SyntaxError('invalid intrinsic syntax, expected opening `%`');
		}
		var result = [];
		$replace(string, rePropName, function (match, number, quote, subString) {
			result[result.length] = quote ? $replace(subString, reEscapeChar, '$1') : number || match;
		});
		return result;
	};
	/* end adaptation */

	var getBaseIntrinsic = function getBaseIntrinsic(name, allowMissing) {
		var intrinsicName = name;
		var alias;
		if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
			alias = LEGACY_ALIASES[intrinsicName];
			intrinsicName = '%' + alias[0] + '%';
		}

		if (hasOwn(INTRINSICS, intrinsicName)) {
			var value = INTRINSICS[intrinsicName];
			if (value === needsEval) {
				value = doEval(intrinsicName);
			}
			if (typeof value === 'undefined' && !allowMissing) {
				throw new $TypeError('intrinsic ' + name + ' exists, but is not available. Please file an issue!');
			}

			return {
				alias: alias,
				name: intrinsicName,
				value: value
			};
		}

		throw new $SyntaxError('intrinsic ' + name + ' does not exist!');
	};

	getIntrinsic = function GetIntrinsic(name, allowMissing) {
		if (typeof name !== 'string' || name.length === 0) {
			throw new $TypeError('intrinsic name must be a non-empty string');
		}
		if (arguments.length > 1 && typeof allowMissing !== 'boolean') {
			throw new $TypeError('"allowMissing" argument must be a boolean');
		}

		if ($exec(/^%?[^%]*%?$/, name) === null) {
			throw new $SyntaxError('`%` may not be present anywhere but at the beginning and end of the intrinsic name');
		}
		var parts = stringToPath(name);
		var intrinsicBaseName = parts.length > 0 ? parts[0] : '';

		var intrinsic = getBaseIntrinsic('%' + intrinsicBaseName + '%', allowMissing);
		var intrinsicRealName = intrinsic.name;
		var value = intrinsic.value;
		var skipFurtherCaching = false;

		var alias = intrinsic.alias;
		if (alias) {
			intrinsicBaseName = alias[0];
			$spliceApply(parts, $concat([0, 1], alias));
		}

		for (var i = 1, isOwn = true; i < parts.length; i += 1) {
			var part = parts[i];
			var first = $strSlice(part, 0, 1);
			var last = $strSlice(part, -1);
			if (
				(
					(first === '"' || first === "'" || first === '`')
					|| (last === '"' || last === "'" || last === '`')
				)
				&& first !== last
			) {
				throw new $SyntaxError('property names with quotes must have matching quotes');
			}
			if (part === 'constructor' || !isOwn) {
				skipFurtherCaching = true;
			}

			intrinsicBaseName += '.' + part;
			intrinsicRealName = '%' + intrinsicBaseName + '%';

			if (hasOwn(INTRINSICS, intrinsicRealName)) {
				value = INTRINSICS[intrinsicRealName];
			} else if (value != null) {
				if (!(part in value)) {
					if (!allowMissing) {
						throw new $TypeError('base intrinsic for ' + name + ' exists, but the property is not available.');
					}
					return void undefined$1;
				}
				if ($gOPD && (i + 1) >= parts.length) {
					var desc = $gOPD(value, part);
					isOwn = !!desc;

					// By convention, when a data property is converted to an accessor
					// property to emulate a data property that does not suffer from
					// the override mistake, that accessor's getter is marked with
					// an `originalValue` property. Here, when we detect this, we
					// uphold the illusion by pretending to see that original data
					// property, i.e., returning the value rather than the getter
					// itself.
					if (isOwn && 'get' in desc && !('originalValue' in desc.get)) {
						value = desc.get;
					} else {
						value = value[part];
					}
				} else {
					isOwn = hasOwn(value, part);
					value = value[part];
				}

				if (isOwn && !skipFurtherCaching) {
					INTRINSICS[intrinsicRealName] = value;
				}
			}
		}
		return value;
	};
	return getIntrinsic;
}

var callBind = {exports: {}};

var esDefineProperty;
var hasRequiredEsDefineProperty;

function requireEsDefineProperty () {
	if (hasRequiredEsDefineProperty) return esDefineProperty;
	hasRequiredEsDefineProperty = 1;

	var GetIntrinsic = requireGetIntrinsic();

	/** @type {import('.')} */
	var $defineProperty = GetIntrinsic('%Object.defineProperty%', true) || false;
	if ($defineProperty) {
		try {
			$defineProperty({}, 'a', { value: 1 });
		} catch (e) {
			// IE 8 has a broken defineProperty
			$defineProperty = false;
		}
	}

	esDefineProperty = $defineProperty;
	return esDefineProperty;
}

var gopd;
var hasRequiredGopd;

function requireGopd () {
	if (hasRequiredGopd) return gopd;
	hasRequiredGopd = 1;

	var GetIntrinsic = requireGetIntrinsic();

	var $gOPD = GetIntrinsic('%Object.getOwnPropertyDescriptor%', true);

	if ($gOPD) {
		try {
			$gOPD([], 'length');
		} catch (e) {
			// IE 8 has a broken gOPD
			$gOPD = null;
		}
	}

	gopd = $gOPD;
	return gopd;
}

var defineDataProperty;
var hasRequiredDefineDataProperty;

function requireDefineDataProperty () {
	if (hasRequiredDefineDataProperty) return defineDataProperty;
	hasRequiredDefineDataProperty = 1;

	var $defineProperty = requireEsDefineProperty();

	var $SyntaxError = requireSyntax();
	var $TypeError = requireType();

	var gopd = requireGopd();
	defineDataProperty = function defineDataProperty(
		obj,
		property,
		value
	) {
		if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
			throw new $TypeError('`obj` must be an object or a function`');
		}
		if (typeof property !== 'string' && typeof property !== 'symbol') {
			throw new $TypeError('`property` must be a string or a symbol`');
		}
		if (arguments.length > 3 && typeof arguments[3] !== 'boolean' && arguments[3] !== null) {
			throw new $TypeError('`nonEnumerable`, if provided, must be a boolean or null');
		}
		if (arguments.length > 4 && typeof arguments[4] !== 'boolean' && arguments[4] !== null) {
			throw new $TypeError('`nonWritable`, if provided, must be a boolean or null');
		}
		if (arguments.length > 5 && typeof arguments[5] !== 'boolean' && arguments[5] !== null) {
			throw new $TypeError('`nonConfigurable`, if provided, must be a boolean or null');
		}
		if (arguments.length > 6 && typeof arguments[6] !== 'boolean') {
			throw new $TypeError('`loose`, if provided, must be a boolean');
		}

		var nonEnumerable = arguments.length > 3 ? arguments[3] : null;
		var nonWritable = arguments.length > 4 ? arguments[4] : null;
		var nonConfigurable = arguments.length > 5 ? arguments[5] : null;
		var loose = arguments.length > 6 ? arguments[6] : false;

		/* @type {false | TypedPropertyDescriptor<unknown>} */
		var desc = !!gopd && gopd(obj, property);

		if ($defineProperty) {
			$defineProperty(obj, property, {
				configurable: nonConfigurable === null && desc ? desc.configurable : !nonConfigurable,
				enumerable: nonEnumerable === null && desc ? desc.enumerable : !nonEnumerable,
				value: value,
				writable: nonWritable === null && desc ? desc.writable : !nonWritable
			});
		} else if (loose || (!nonEnumerable && !nonWritable && !nonConfigurable)) {
			// must fall back to [[Set]], and was not explicitly asked to make non-enumerable, non-writable, or non-configurable
			obj[property] = value; // eslint-disable-line no-param-reassign
		} else {
			throw new $SyntaxError('This environment does not support defining a property as non-configurable, non-writable, or non-enumerable.');
		}
	};
	return defineDataProperty;
}

var hasPropertyDescriptors_1;
var hasRequiredHasPropertyDescriptors;

function requireHasPropertyDescriptors () {
	if (hasRequiredHasPropertyDescriptors) return hasPropertyDescriptors_1;
	hasRequiredHasPropertyDescriptors = 1;

	var $defineProperty = requireEsDefineProperty();

	var hasPropertyDescriptors = function hasPropertyDescriptors() {
		return !!$defineProperty;
	};

	hasPropertyDescriptors.hasArrayLengthDefineBug = function hasArrayLengthDefineBug() {
		if (!$defineProperty) {
			return null;
		}
		try {
			return $defineProperty([], 'length', { value: 1 }).length !== 1;
		} catch (e) {
			return true;
		}
	};

	hasPropertyDescriptors_1 = hasPropertyDescriptors;
	return hasPropertyDescriptors_1;
}

var setFunctionLength;
var hasRequiredSetFunctionLength;

function requireSetFunctionLength () {
	if (hasRequiredSetFunctionLength) return setFunctionLength;
	hasRequiredSetFunctionLength = 1;

	var GetIntrinsic = requireGetIntrinsic();
	var define = requireDefineDataProperty();
	var hasDescriptors = requireHasPropertyDescriptors()();
	var gOPD = requireGopd();

	var $TypeError = requireType();
	var $floor = GetIntrinsic('%Math.floor%');

	/** @type {import('.')} */
	setFunctionLength = function setFunctionLength(fn, length) {
		if (typeof fn !== 'function') {
			throw new $TypeError('`fn` is not a function');
		}
		if (typeof length !== 'number' || length < 0 || length > 0xFFFFFFFF || $floor(length) !== length) {
			throw new $TypeError('`length` must be a positive 32-bit integer');
		}

		var loose = arguments.length > 2 && !!arguments[2];

		var functionLengthIsConfigurable = true;
		var functionLengthIsWritable = true;
		if ('length' in fn && gOPD) {
			var desc = gOPD(fn, 'length');
			if (desc && !desc.configurable) {
				functionLengthIsConfigurable = false;
			}
			if (desc && !desc.writable) {
				functionLengthIsWritable = false;
			}
		}

		if (functionLengthIsConfigurable || functionLengthIsWritable || !loose) {
			if (hasDescriptors) {
				define(/** @type {Parameters<define>[0]} */ (fn), 'length', length, true, true);
			} else {
				define(/** @type {Parameters<define>[0]} */ (fn), 'length', length);
			}
		}
		return fn;
	};
	return setFunctionLength;
}

var hasRequiredCallBind;

function requireCallBind () {
	if (hasRequiredCallBind) return callBind.exports;
	hasRequiredCallBind = 1;
	(function (module) {

		var bind = requireFunctionBind();
		var GetIntrinsic = requireGetIntrinsic();
		var setFunctionLength = requireSetFunctionLength();

		var $TypeError = requireType();
		var $apply = GetIntrinsic('%Function.prototype.apply%');
		var $call = GetIntrinsic('%Function.prototype.call%');
		var $reflectApply = GetIntrinsic('%Reflect.apply%', true) || bind.call($call, $apply);

		var $defineProperty = requireEsDefineProperty();
		var $max = GetIntrinsic('%Math.max%');

		module.exports = function callBind(originalFunction) {
			if (typeof originalFunction !== 'function') {
				throw new $TypeError('a function is required');
			}
			var func = $reflectApply(bind, $call, arguments);
			return setFunctionLength(
				func,
				1 + $max(0, originalFunction.length - (arguments.length - 1)),
				true
			);
		};

		var applyBind = function applyBind() {
			return $reflectApply(bind, $apply, arguments);
		};

		if ($defineProperty) {
			$defineProperty(module.exports, 'apply', { value: applyBind });
		} else {
			module.exports.apply = applyBind;
		} 
	} (callBind));
	return callBind.exports;
}

var callBound;
var hasRequiredCallBound;

function requireCallBound () {
	if (hasRequiredCallBound) return callBound;
	hasRequiredCallBound = 1;

	var GetIntrinsic = requireGetIntrinsic();

	var callBind = requireCallBind();

	var $indexOf = callBind(GetIntrinsic('String.prototype.indexOf'));

	callBound = function callBoundIntrinsic(name, allowMissing) {
		var intrinsic = GetIntrinsic(name, !!allowMissing);
		if (typeof intrinsic === 'function' && $indexOf(name, '.prototype.') > -1) {
			return callBind(intrinsic);
		}
		return intrinsic;
	};
	return callBound;
}

var util_inspect;
var hasRequiredUtil_inspect;

function requireUtil_inspect () {
	if (hasRequiredUtil_inspect) return util_inspect;
	hasRequiredUtil_inspect = 1;
	util_inspect = require$$1$1.inspect;
	return util_inspect;
}

var objectInspect;
var hasRequiredObjectInspect;

function requireObjectInspect () {
	if (hasRequiredObjectInspect) return objectInspect;
	hasRequiredObjectInspect = 1;
	var hasMap = typeof Map === 'function' && Map.prototype;
	var mapSizeDescriptor = Object.getOwnPropertyDescriptor && hasMap ? Object.getOwnPropertyDescriptor(Map.prototype, 'size') : null;
	var mapSize = hasMap && mapSizeDescriptor && typeof mapSizeDescriptor.get === 'function' ? mapSizeDescriptor.get : null;
	var mapForEach = hasMap && Map.prototype.forEach;
	var hasSet = typeof Set === 'function' && Set.prototype;
	var setSizeDescriptor = Object.getOwnPropertyDescriptor && hasSet ? Object.getOwnPropertyDescriptor(Set.prototype, 'size') : null;
	var setSize = hasSet && setSizeDescriptor && typeof setSizeDescriptor.get === 'function' ? setSizeDescriptor.get : null;
	var setForEach = hasSet && Set.prototype.forEach;
	var hasWeakMap = typeof WeakMap === 'function' && WeakMap.prototype;
	var weakMapHas = hasWeakMap ? WeakMap.prototype.has : null;
	var hasWeakSet = typeof WeakSet === 'function' && WeakSet.prototype;
	var weakSetHas = hasWeakSet ? WeakSet.prototype.has : null;
	var hasWeakRef = typeof WeakRef === 'function' && WeakRef.prototype;
	var weakRefDeref = hasWeakRef ? WeakRef.prototype.deref : null;
	var booleanValueOf = Boolean.prototype.valueOf;
	var objectToString = Object.prototype.toString;
	var functionToString = Function.prototype.toString;
	var $match = String.prototype.match;
	var $slice = String.prototype.slice;
	var $replace = String.prototype.replace;
	var $toUpperCase = String.prototype.toUpperCase;
	var $toLowerCase = String.prototype.toLowerCase;
	var $test = RegExp.prototype.test;
	var $concat = Array.prototype.concat;
	var $join = Array.prototype.join;
	var $arrSlice = Array.prototype.slice;
	var $floor = Math.floor;
	var bigIntValueOf = typeof BigInt === 'function' ? BigInt.prototype.valueOf : null;
	var gOPS = Object.getOwnPropertySymbols;
	var symToString = typeof Symbol === 'function' && typeof Symbol.iterator === 'symbol' ? Symbol.prototype.toString : null;
	var hasShammedSymbols = typeof Symbol === 'function' && typeof Symbol.iterator === 'object';
	// ie, `has-tostringtag/shams
	var toStringTag = typeof Symbol === 'function' && Symbol.toStringTag && (typeof Symbol.toStringTag === hasShammedSymbols ? 'object' : 'symbol')
	    ? Symbol.toStringTag
	    : null;
	var isEnumerable = Object.prototype.propertyIsEnumerable;

	var gPO = (typeof Reflect === 'function' ? Reflect.getPrototypeOf : Object.getPrototypeOf) || (
	    [].__proto__ === Array.prototype // eslint-disable-line no-proto
	        ? function (O) {
	            return O.__proto__; // eslint-disable-line no-proto
	        }
	        : null
	);

	function addNumericSeparator(num, str) {
	    if (
	        num === Infinity
	        || num === -Infinity
	        || num !== num
	        || (num && num > -1000 && num < 1000)
	        || $test.call(/e/, str)
	    ) {
	        return str;
	    }
	    var sepRegex = /[0-9](?=(?:[0-9]{3})+(?![0-9]))/g;
	    if (typeof num === 'number') {
	        var int = num < 0 ? -$floor(-num) : $floor(num); // trunc(num)
	        if (int !== num) {
	            var intStr = String(int);
	            var dec = $slice.call(str, intStr.length + 1);
	            return $replace.call(intStr, sepRegex, '$&_') + '.' + $replace.call($replace.call(dec, /([0-9]{3})/g, '$&_'), /_$/, '');
	        }
	    }
	    return $replace.call(str, sepRegex, '$&_');
	}

	var utilInspect = requireUtil_inspect();
	var inspectCustom = utilInspect.custom;
	var inspectSymbol = isSymbol(inspectCustom) ? inspectCustom : null;

	objectInspect = function inspect_(obj, options, depth, seen) {
	    var opts = options || {};

	    if (has(opts, 'quoteStyle') && (opts.quoteStyle !== 'single' && opts.quoteStyle !== 'double')) {
	        throw new TypeError('option "quoteStyle" must be "single" or "double"');
	    }
	    if (
	        has(opts, 'maxStringLength') && (typeof opts.maxStringLength === 'number'
	            ? opts.maxStringLength < 0 && opts.maxStringLength !== Infinity
	            : opts.maxStringLength !== null
	        )
	    ) {
	        throw new TypeError('option "maxStringLength", if provided, must be a positive integer, Infinity, or `null`');
	    }
	    var customInspect = has(opts, 'customInspect') ? opts.customInspect : true;
	    if (typeof customInspect !== 'boolean' && customInspect !== 'symbol') {
	        throw new TypeError('option "customInspect", if provided, must be `true`, `false`, or `\'symbol\'`');
	    }

	    if (
	        has(opts, 'indent')
	        && opts.indent !== null
	        && opts.indent !== '\t'
	        && !(parseInt(opts.indent, 10) === opts.indent && opts.indent > 0)
	    ) {
	        throw new TypeError('option "indent" must be "\\t", an integer > 0, or `null`');
	    }
	    if (has(opts, 'numericSeparator') && typeof opts.numericSeparator !== 'boolean') {
	        throw new TypeError('option "numericSeparator", if provided, must be `true` or `false`');
	    }
	    var numericSeparator = opts.numericSeparator;

	    if (typeof obj === 'undefined') {
	        return 'undefined';
	    }
	    if (obj === null) {
	        return 'null';
	    }
	    if (typeof obj === 'boolean') {
	        return obj ? 'true' : 'false';
	    }

	    if (typeof obj === 'string') {
	        return inspectString(obj, opts);
	    }
	    if (typeof obj === 'number') {
	        if (obj === 0) {
	            return Infinity / obj > 0 ? '0' : '-0';
	        }
	        var str = String(obj);
	        return numericSeparator ? addNumericSeparator(obj, str) : str;
	    }
	    if (typeof obj === 'bigint') {
	        var bigIntStr = String(obj) + 'n';
	        return numericSeparator ? addNumericSeparator(obj, bigIntStr) : bigIntStr;
	    }

	    var maxDepth = typeof opts.depth === 'undefined' ? 5 : opts.depth;
	    if (typeof depth === 'undefined') { depth = 0; }
	    if (depth >= maxDepth && maxDepth > 0 && typeof obj === 'object') {
	        return isArray(obj) ? '[Array]' : '[Object]';
	    }

	    var indent = getIndent(opts, depth);

	    if (typeof seen === 'undefined') {
	        seen = [];
	    } else if (indexOf(seen, obj) >= 0) {
	        return '[Circular]';
	    }

	    function inspect(value, from, noIndent) {
	        if (from) {
	            seen = $arrSlice.call(seen);
	            seen.push(from);
	        }
	        if (noIndent) {
	            var newOpts = {
	                depth: opts.depth
	            };
	            if (has(opts, 'quoteStyle')) {
	                newOpts.quoteStyle = opts.quoteStyle;
	            }
	            return inspect_(value, newOpts, depth + 1, seen);
	        }
	        return inspect_(value, opts, depth + 1, seen);
	    }

	    if (typeof obj === 'function' && !isRegExp(obj)) { // in older engines, regexes are callable
	        var name = nameOf(obj);
	        var keys = arrObjKeys(obj, inspect);
	        return '[Function' + (name ? ': ' + name : ' (anonymous)') + ']' + (keys.length > 0 ? ' { ' + $join.call(keys, ', ') + ' }' : '');
	    }
	    if (isSymbol(obj)) {
	        var symString = hasShammedSymbols ? $replace.call(String(obj), /^(Symbol\(.*\))_[^)]*$/, '$1') : symToString.call(obj);
	        return typeof obj === 'object' && !hasShammedSymbols ? markBoxed(symString) : symString;
	    }
	    if (isElement(obj)) {
	        var s = '<' + $toLowerCase.call(String(obj.nodeName));
	        var attrs = obj.attributes || [];
	        for (var i = 0; i < attrs.length; i++) {
	            s += ' ' + attrs[i].name + '=' + wrapQuotes(quote(attrs[i].value), 'double', opts);
	        }
	        s += '>';
	        if (obj.childNodes && obj.childNodes.length) { s += '...'; }
	        s += '</' + $toLowerCase.call(String(obj.nodeName)) + '>';
	        return s;
	    }
	    if (isArray(obj)) {
	        if (obj.length === 0) { return '[]'; }
	        var xs = arrObjKeys(obj, inspect);
	        if (indent && !singleLineValues(xs)) {
	            return '[' + indentedJoin(xs, indent) + ']';
	        }
	        return '[ ' + $join.call(xs, ', ') + ' ]';
	    }
	    if (isError(obj)) {
	        var parts = arrObjKeys(obj, inspect);
	        if (!('cause' in Error.prototype) && 'cause' in obj && !isEnumerable.call(obj, 'cause')) {
	            return '{ [' + String(obj) + '] ' + $join.call($concat.call('[cause]: ' + inspect(obj.cause), parts), ', ') + ' }';
	        }
	        if (parts.length === 0) { return '[' + String(obj) + ']'; }
	        return '{ [' + String(obj) + '] ' + $join.call(parts, ', ') + ' }';
	    }
	    if (typeof obj === 'object' && customInspect) {
	        if (inspectSymbol && typeof obj[inspectSymbol] === 'function' && utilInspect) {
	            return utilInspect(obj, { depth: maxDepth - depth });
	        } else if (customInspect !== 'symbol' && typeof obj.inspect === 'function') {
	            return obj.inspect();
	        }
	    }
	    if (isMap(obj)) {
	        var mapParts = [];
	        if (mapForEach) {
	            mapForEach.call(obj, function (value, key) {
	                mapParts.push(inspect(key, obj, true) + ' => ' + inspect(value, obj));
	            });
	        }
	        return collectionOf('Map', mapSize.call(obj), mapParts, indent);
	    }
	    if (isSet(obj)) {
	        var setParts = [];
	        if (setForEach) {
	            setForEach.call(obj, function (value) {
	                setParts.push(inspect(value, obj));
	            });
	        }
	        return collectionOf('Set', setSize.call(obj), setParts, indent);
	    }
	    if (isWeakMap(obj)) {
	        return weakCollectionOf('WeakMap');
	    }
	    if (isWeakSet(obj)) {
	        return weakCollectionOf('WeakSet');
	    }
	    if (isWeakRef(obj)) {
	        return weakCollectionOf('WeakRef');
	    }
	    if (isNumber(obj)) {
	        return markBoxed(inspect(Number(obj)));
	    }
	    if (isBigInt(obj)) {
	        return markBoxed(inspect(bigIntValueOf.call(obj)));
	    }
	    if (isBoolean(obj)) {
	        return markBoxed(booleanValueOf.call(obj));
	    }
	    if (isString(obj)) {
	        return markBoxed(inspect(String(obj)));
	    }
	    // note: in IE 8, sometimes `global !== window` but both are the prototypes of each other
	    /* eslint-env browser */
	    if (typeof window !== 'undefined' && obj === window) {
	        return '{ [object Window] }';
	    }
	    if (obj === commonjsGlobal) {
	        return '{ [object globalThis] }';
	    }
	    if (!isDate(obj) && !isRegExp(obj)) {
	        var ys = arrObjKeys(obj, inspect);
	        var isPlainObject = gPO ? gPO(obj) === Object.prototype : obj instanceof Object || obj.constructor === Object;
	        var protoTag = obj instanceof Object ? '' : 'null prototype';
	        var stringTag = !isPlainObject && toStringTag && Object(obj) === obj && toStringTag in obj ? $slice.call(toStr(obj), 8, -1) : protoTag ? 'Object' : '';
	        var constructorTag = isPlainObject || typeof obj.constructor !== 'function' ? '' : obj.constructor.name ? obj.constructor.name + ' ' : '';
	        var tag = constructorTag + (stringTag || protoTag ? '[' + $join.call($concat.call([], stringTag || [], protoTag || []), ': ') + '] ' : '');
	        if (ys.length === 0) { return tag + '{}'; }
	        if (indent) {
	            return tag + '{' + indentedJoin(ys, indent) + '}';
	        }
	        return tag + '{ ' + $join.call(ys, ', ') + ' }';
	    }
	    return String(obj);
	};

	function wrapQuotes(s, defaultStyle, opts) {
	    var quoteChar = (opts.quoteStyle || defaultStyle) === 'double' ? '"' : "'";
	    return quoteChar + s + quoteChar;
	}

	function quote(s) {
	    return $replace.call(String(s), /"/g, '&quot;');
	}

	function isArray(obj) { return toStr(obj) === '[object Array]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
	function isDate(obj) { return toStr(obj) === '[object Date]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
	function isRegExp(obj) { return toStr(obj) === '[object RegExp]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
	function isError(obj) { return toStr(obj) === '[object Error]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
	function isString(obj) { return toStr(obj) === '[object String]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
	function isNumber(obj) { return toStr(obj) === '[object Number]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }
	function isBoolean(obj) { return toStr(obj) === '[object Boolean]' && (!toStringTag || !(typeof obj === 'object' && toStringTag in obj)); }

	// Symbol and BigInt do have Symbol.toStringTag by spec, so that can't be used to eliminate false positives
	function isSymbol(obj) {
	    if (hasShammedSymbols) {
	        return obj && typeof obj === 'object' && obj instanceof Symbol;
	    }
	    if (typeof obj === 'symbol') {
	        return true;
	    }
	    if (!obj || typeof obj !== 'object' || !symToString) {
	        return false;
	    }
	    try {
	        symToString.call(obj);
	        return true;
	    } catch (e) {}
	    return false;
	}

	function isBigInt(obj) {
	    if (!obj || typeof obj !== 'object' || !bigIntValueOf) {
	        return false;
	    }
	    try {
	        bigIntValueOf.call(obj);
	        return true;
	    } catch (e) {}
	    return false;
	}

	var hasOwn = Object.prototype.hasOwnProperty || function (key) { return key in this; };
	function has(obj, key) {
	    return hasOwn.call(obj, key);
	}

	function toStr(obj) {
	    return objectToString.call(obj);
	}

	function nameOf(f) {
	    if (f.name) { return f.name; }
	    var m = $match.call(functionToString.call(f), /^function\s*([\w$]+)/);
	    if (m) { return m[1]; }
	    return null;
	}

	function indexOf(xs, x) {
	    if (xs.indexOf) { return xs.indexOf(x); }
	    for (var i = 0, l = xs.length; i < l; i++) {
	        if (xs[i] === x) { return i; }
	    }
	    return -1;
	}

	function isMap(x) {
	    if (!mapSize || !x || typeof x !== 'object') {
	        return false;
	    }
	    try {
	        mapSize.call(x);
	        try {
	            setSize.call(x);
	        } catch (s) {
	            return true;
	        }
	        return x instanceof Map; // core-js workaround, pre-v2.5.0
	    } catch (e) {}
	    return false;
	}

	function isWeakMap(x) {
	    if (!weakMapHas || !x || typeof x !== 'object') {
	        return false;
	    }
	    try {
	        weakMapHas.call(x, weakMapHas);
	        try {
	            weakSetHas.call(x, weakSetHas);
	        } catch (s) {
	            return true;
	        }
	        return x instanceof WeakMap; // core-js workaround, pre-v2.5.0
	    } catch (e) {}
	    return false;
	}

	function isWeakRef(x) {
	    if (!weakRefDeref || !x || typeof x !== 'object') {
	        return false;
	    }
	    try {
	        weakRefDeref.call(x);
	        return true;
	    } catch (e) {}
	    return false;
	}

	function isSet(x) {
	    if (!setSize || !x || typeof x !== 'object') {
	        return false;
	    }
	    try {
	        setSize.call(x);
	        try {
	            mapSize.call(x);
	        } catch (m) {
	            return true;
	        }
	        return x instanceof Set; // core-js workaround, pre-v2.5.0
	    } catch (e) {}
	    return false;
	}

	function isWeakSet(x) {
	    if (!weakSetHas || !x || typeof x !== 'object') {
	        return false;
	    }
	    try {
	        weakSetHas.call(x, weakSetHas);
	        try {
	            weakMapHas.call(x, weakMapHas);
	        } catch (s) {
	            return true;
	        }
	        return x instanceof WeakSet; // core-js workaround, pre-v2.5.0
	    } catch (e) {}
	    return false;
	}

	function isElement(x) {
	    if (!x || typeof x !== 'object') { return false; }
	    if (typeof HTMLElement !== 'undefined' && x instanceof HTMLElement) {
	        return true;
	    }
	    return typeof x.nodeName === 'string' && typeof x.getAttribute === 'function';
	}

	function inspectString(str, opts) {
	    if (str.length > opts.maxStringLength) {
	        var remaining = str.length - opts.maxStringLength;
	        var trailer = '... ' + remaining + ' more character' + (remaining > 1 ? 's' : '');
	        return inspectString($slice.call(str, 0, opts.maxStringLength), opts) + trailer;
	    }
	    // eslint-disable-next-line no-control-regex
	    var s = $replace.call($replace.call(str, /(['\\])/g, '\\$1'), /[\x00-\x1f]/g, lowbyte);
	    return wrapQuotes(s, 'single', opts);
	}

	function lowbyte(c) {
	    var n = c.charCodeAt(0);
	    var x = {
	        8: 'b',
	        9: 't',
	        10: 'n',
	        12: 'f',
	        13: 'r'
	    }[n];
	    if (x) { return '\\' + x; }
	    return '\\x' + (n < 0x10 ? '0' : '') + $toUpperCase.call(n.toString(16));
	}

	function markBoxed(str) {
	    return 'Object(' + str + ')';
	}

	function weakCollectionOf(type) {
	    return type + ' { ? }';
	}

	function collectionOf(type, size, entries, indent) {
	    var joinedEntries = indent ? indentedJoin(entries, indent) : $join.call(entries, ', ');
	    return type + ' (' + size + ') {' + joinedEntries + '}';
	}

	function singleLineValues(xs) {
	    for (var i = 0; i < xs.length; i++) {
	        if (indexOf(xs[i], '\n') >= 0) {
	            return false;
	        }
	    }
	    return true;
	}

	function getIndent(opts, depth) {
	    var baseIndent;
	    if (opts.indent === '\t') {
	        baseIndent = '\t';
	    } else if (typeof opts.indent === 'number' && opts.indent > 0) {
	        baseIndent = $join.call(Array(opts.indent + 1), ' ');
	    } else {
	        return null;
	    }
	    return {
	        base: baseIndent,
	        prev: $join.call(Array(depth + 1), baseIndent)
	    };
	}

	function indentedJoin(xs, indent) {
	    if (xs.length === 0) { return ''; }
	    var lineJoiner = '\n' + indent.prev + indent.base;
	    return lineJoiner + $join.call(xs, ',' + lineJoiner) + '\n' + indent.prev;
	}

	function arrObjKeys(obj, inspect) {
	    var isArr = isArray(obj);
	    var xs = [];
	    if (isArr) {
	        xs.length = obj.length;
	        for (var i = 0; i < obj.length; i++) {
	            xs[i] = has(obj, i) ? inspect(obj[i], obj) : '';
	        }
	    }
	    var syms = typeof gOPS === 'function' ? gOPS(obj) : [];
	    var symMap;
	    if (hasShammedSymbols) {
	        symMap = {};
	        for (var k = 0; k < syms.length; k++) {
	            symMap['$' + syms[k]] = syms[k];
	        }
	    }

	    for (var key in obj) { // eslint-disable-line no-restricted-syntax
	        if (!has(obj, key)) { continue; } // eslint-disable-line no-restricted-syntax, no-continue
	        if (isArr && String(Number(key)) === key && key < obj.length) { continue; } // eslint-disable-line no-restricted-syntax, no-continue
	        if (hasShammedSymbols && symMap['$' + key] instanceof Symbol) {
	            // this is to prevent shammed Symbols, which are stored as strings, from being included in the string key section
	            continue; // eslint-disable-line no-restricted-syntax, no-continue
	        } else if ($test.call(/[^\w$]/, key)) {
	            xs.push(inspect(key, obj) + ': ' + inspect(obj[key], obj));
	        } else {
	            xs.push(key + ': ' + inspect(obj[key], obj));
	        }
	    }
	    if (typeof gOPS === 'function') {
	        for (var j = 0; j < syms.length; j++) {
	            if (isEnumerable.call(obj, syms[j])) {
	                xs.push('[' + inspect(syms[j]) + ']: ' + inspect(obj[syms[j]], obj));
	            }
	        }
	    }
	    return xs;
	}
	return objectInspect;
}

var sideChannel;
var hasRequiredSideChannel;

function requireSideChannel () {
	if (hasRequiredSideChannel) return sideChannel;
	hasRequiredSideChannel = 1;

	var GetIntrinsic = requireGetIntrinsic();
	var callBound = requireCallBound();
	var inspect = requireObjectInspect();

	var $TypeError = requireType();
	var $WeakMap = GetIntrinsic('%WeakMap%', true);
	var $Map = GetIntrinsic('%Map%', true);

	var $weakMapGet = callBound('WeakMap.prototype.get', true);
	var $weakMapSet = callBound('WeakMap.prototype.set', true);
	var $weakMapHas = callBound('WeakMap.prototype.has', true);
	var $mapGet = callBound('Map.prototype.get', true);
	var $mapSet = callBound('Map.prototype.set', true);
	var $mapHas = callBound('Map.prototype.has', true);

	var listGetNode = function (list, key) { // eslint-disable-line consistent-return
		/** @type {typeof list | NonNullable<(typeof list)['next']>} */
		var prev = list;
		/** @type {(typeof list)['next']} */
		var curr;
		for (; (curr = prev.next) !== null; prev = curr) {
			if (curr.key === key) {
				prev.next = curr.next;
				// eslint-disable-next-line no-extra-parens
				curr.next = /** @type {NonNullable<typeof list.next>} */ (list.next);
				list.next = curr; // eslint-disable-line no-param-reassign
				return curr;
			}
		}
	};

	/** @type {import('.').listGet} */
	var listGet = function (objects, key) {
		var node = listGetNode(objects, key);
		return node && node.value;
	};
	/** @type {import('.').listSet} */
	var listSet = function (objects, key, value) {
		var node = listGetNode(objects, key);
		if (node) {
			node.value = value;
		} else {
			// Prepend the new node to the beginning of the list
			objects.next = /** @type {import('.').ListNode<typeof value>} */ ({ // eslint-disable-line no-param-reassign, no-extra-parens
				key: key,
				next: objects.next,
				value: value
			});
		}
	};
	/** @type {import('.').listHas} */
	var listHas = function (objects, key) {
		return !!listGetNode(objects, key);
	};

	/** @type {import('.')} */
	sideChannel = function getSideChannel() {
		/** @type {WeakMap<object, unknown>} */ var $wm;
		/** @type {Map<object, unknown>} */ var $m;
		/** @type {import('.').RootNode<unknown>} */ var $o;

		/** @type {import('.').Channel} */
		var channel = {
			assert: function (key) {
				if (!channel.has(key)) {
					throw new $TypeError('Side channel does not contain ' + inspect(key));
				}
			},
			get: function (key) { // eslint-disable-line consistent-return
				if ($WeakMap && key && (typeof key === 'object' || typeof key === 'function')) {
					if ($wm) {
						return $weakMapGet($wm, key);
					}
				} else if ($Map) {
					if ($m) {
						return $mapGet($m, key);
					}
				} else {
					if ($o) { // eslint-disable-line no-lonely-if
						return listGet($o, key);
					}
				}
			},
			has: function (key) {
				if ($WeakMap && key && (typeof key === 'object' || typeof key === 'function')) {
					if ($wm) {
						return $weakMapHas($wm, key);
					}
				} else if ($Map) {
					if ($m) {
						return $mapHas($m, key);
					}
				} else {
					if ($o) { // eslint-disable-line no-lonely-if
						return listHas($o, key);
					}
				}
				return false;
			},
			set: function (key, value) {
				if ($WeakMap && key && (typeof key === 'object' || typeof key === 'function')) {
					if (!$wm) {
						$wm = new $WeakMap();
					}
					$weakMapSet($wm, key, value);
				} else if ($Map) {
					if (!$m) {
						$m = new $Map();
					}
					$mapSet($m, key, value);
				} else {
					if (!$o) {
						// Initialize the linked list as an empty node, so that we don't have to special-case handling of the first node: we can always refer to it as (previous node).next, instead of something like (list).head
						$o = { key: {}, next: null };
					}
					listSet($o, key, value);
				}
			}
		};
		return channel;
	};
	return sideChannel;
}

var formats;
var hasRequiredFormats;

function requireFormats () {
	if (hasRequiredFormats) return formats;
	hasRequiredFormats = 1;

	var replace = String.prototype.replace;
	var percentTwenties = /%20/g;

	var Format = {
	    RFC1738: 'RFC1738',
	    RFC3986: 'RFC3986'
	};

	formats = {
	    'default': Format.RFC3986,
	    formatters: {
	        RFC1738: function (value) {
	            return replace.call(value, percentTwenties, '+');
	        },
	        RFC3986: function (value) {
	            return String(value);
	        }
	    },
	    RFC1738: Format.RFC1738,
	    RFC3986: Format.RFC3986
	};
	return formats;
}

var utils;
var hasRequiredUtils;

function requireUtils () {
	if (hasRequiredUtils) return utils;
	hasRequiredUtils = 1;

	var formats = requireFormats();

	var has = Object.prototype.hasOwnProperty;
	var isArray = Array.isArray;

	var hexTable = (function () {
	    var array = [];
	    for (var i = 0; i < 256; ++i) {
	        array.push('%' + ((i < 16 ? '0' : '') + i.toString(16)).toUpperCase());
	    }

	    return array;
	}());

	var compactQueue = function compactQueue(queue) {
	    while (queue.length > 1) {
	        var item = queue.pop();
	        var obj = item.obj[item.prop];

	        if (isArray(obj)) {
	            var compacted = [];

	            for (var j = 0; j < obj.length; ++j) {
	                if (typeof obj[j] !== 'undefined') {
	                    compacted.push(obj[j]);
	                }
	            }

	            item.obj[item.prop] = compacted;
	        }
	    }
	};

	var arrayToObject = function arrayToObject(source, options) {
	    var obj = options && options.plainObjects ? Object.create(null) : {};
	    for (var i = 0; i < source.length; ++i) {
	        if (typeof source[i] !== 'undefined') {
	            obj[i] = source[i];
	        }
	    }

	    return obj;
	};

	var merge = function merge(target, source, options) {
	    /* eslint no-param-reassign: 0 */
	    if (!source) {
	        return target;
	    }

	    if (typeof source !== 'object') {
	        if (isArray(target)) {
	            target.push(source);
	        } else if (target && typeof target === 'object') {
	            if ((options && (options.plainObjects || options.allowPrototypes)) || !has.call(Object.prototype, source)) {
	                target[source] = true;
	            }
	        } else {
	            return [target, source];
	        }

	        return target;
	    }

	    if (!target || typeof target !== 'object') {
	        return [target].concat(source);
	    }

	    var mergeTarget = target;
	    if (isArray(target) && !isArray(source)) {
	        mergeTarget = arrayToObject(target, options);
	    }

	    if (isArray(target) && isArray(source)) {
	        source.forEach(function (item, i) {
	            if (has.call(target, i)) {
	                var targetItem = target[i];
	                if (targetItem && typeof targetItem === 'object' && item && typeof item === 'object') {
	                    target[i] = merge(targetItem, item, options);
	                } else {
	                    target.push(item);
	                }
	            } else {
	                target[i] = item;
	            }
	        });
	        return target;
	    }

	    return Object.keys(source).reduce(function (acc, key) {
	        var value = source[key];

	        if (has.call(acc, key)) {
	            acc[key] = merge(acc[key], value, options);
	        } else {
	            acc[key] = value;
	        }
	        return acc;
	    }, mergeTarget);
	};

	var assign = function assignSingleSource(target, source) {
	    return Object.keys(source).reduce(function (acc, key) {
	        acc[key] = source[key];
	        return acc;
	    }, target);
	};

	var decode = function (str, decoder, charset) {
	    var strWithoutPlus = str.replace(/\+/g, ' ');
	    if (charset === 'iso-8859-1') {
	        // unescape never throws, no try...catch needed:
	        return strWithoutPlus.replace(/%[0-9a-f]{2}/gi, unescape);
	    }
	    // utf-8
	    try {
	        return decodeURIComponent(strWithoutPlus);
	    } catch (e) {
	        return strWithoutPlus;
	    }
	};

	var encode = function encode(str, defaultEncoder, charset, kind, format) {
	    // This code was originally written by Brian White (mscdex) for the io.js core querystring library.
	    // It has been adapted here for stricter adherence to RFC 3986
	    if (str.length === 0) {
	        return str;
	    }

	    var string = str;
	    if (typeof str === 'symbol') {
	        string = Symbol.prototype.toString.call(str);
	    } else if (typeof str !== 'string') {
	        string = String(str);
	    }

	    if (charset === 'iso-8859-1') {
	        return escape(string).replace(/%u[0-9a-f]{4}/gi, function ($0) {
	            return '%26%23' + parseInt($0.slice(2), 16) + '%3B';
	        });
	    }

	    var out = '';
	    for (var i = 0; i < string.length; ++i) {
	        var c = string.charCodeAt(i);

	        if (
	            c === 0x2D // -
	            || c === 0x2E // .
	            || c === 0x5F // _
	            || c === 0x7E // ~
	            || (c >= 0x30 && c <= 0x39) // 0-9
	            || (c >= 0x41 && c <= 0x5A) // a-z
	            || (c >= 0x61 && c <= 0x7A) // A-Z
	            || (format === formats.RFC1738 && (c === 0x28 || c === 0x29)) // ( )
	        ) {
	            out += string.charAt(i);
	            continue;
	        }

	        if (c < 0x80) {
	            out = out + hexTable[c];
	            continue;
	        }

	        if (c < 0x800) {
	            out = out + (hexTable[0xC0 | (c >> 6)] + hexTable[0x80 | (c & 0x3F)]);
	            continue;
	        }

	        if (c < 0xD800 || c >= 0xE000) {
	            out = out + (hexTable[0xE0 | (c >> 12)] + hexTable[0x80 | ((c >> 6) & 0x3F)] + hexTable[0x80 | (c & 0x3F)]);
	            continue;
	        }

	        i += 1;
	        c = 0x10000 + (((c & 0x3FF) << 10) | (string.charCodeAt(i) & 0x3FF));
	        /* eslint operator-linebreak: [2, "before"] */
	        out += hexTable[0xF0 | (c >> 18)]
	            + hexTable[0x80 | ((c >> 12) & 0x3F)]
	            + hexTable[0x80 | ((c >> 6) & 0x3F)]
	            + hexTable[0x80 | (c & 0x3F)];
	    }

	    return out;
	};

	var compact = function compact(value) {
	    var queue = [{ obj: { o: value }, prop: 'o' }];
	    var refs = [];

	    for (var i = 0; i < queue.length; ++i) {
	        var item = queue[i];
	        var obj = item.obj[item.prop];

	        var keys = Object.keys(obj);
	        for (var j = 0; j < keys.length; ++j) {
	            var key = keys[j];
	            var val = obj[key];
	            if (typeof val === 'object' && val !== null && refs.indexOf(val) === -1) {
	                queue.push({ obj: obj, prop: key });
	                refs.push(val);
	            }
	        }
	    }

	    compactQueue(queue);

	    return value;
	};

	var isRegExp = function isRegExp(obj) {
	    return Object.prototype.toString.call(obj) === '[object RegExp]';
	};

	var isBuffer = function isBuffer(obj) {
	    if (!obj || typeof obj !== 'object') {
	        return false;
	    }

	    return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
	};

	var combine = function combine(a, b) {
	    return [].concat(a, b);
	};

	var maybeMap = function maybeMap(val, fn) {
	    if (isArray(val)) {
	        var mapped = [];
	        for (var i = 0; i < val.length; i += 1) {
	            mapped.push(fn(val[i]));
	        }
	        return mapped;
	    }
	    return fn(val);
	};

	utils = {
	    arrayToObject: arrayToObject,
	    assign: assign,
	    combine: combine,
	    compact: compact,
	    decode: decode,
	    encode: encode,
	    isBuffer: isBuffer,
	    isRegExp: isRegExp,
	    maybeMap: maybeMap,
	    merge: merge
	};
	return utils;
}

var stringify_1;
var hasRequiredStringify;

function requireStringify () {
	if (hasRequiredStringify) return stringify_1;
	hasRequiredStringify = 1;

	var getSideChannel = requireSideChannel();
	var utils = requireUtils();
	var formats = requireFormats();
	var has = Object.prototype.hasOwnProperty;

	var arrayPrefixGenerators = {
	    brackets: function brackets(prefix) {
	        return prefix + '[]';
	    },
	    comma: 'comma',
	    indices: function indices(prefix, key) {
	        return prefix + '[' + key + ']';
	    },
	    repeat: function repeat(prefix) {
	        return prefix;
	    }
	};

	var isArray = Array.isArray;
	var split = String.prototype.split;
	var push = Array.prototype.push;
	var pushToArray = function (arr, valueOrArray) {
	    push.apply(arr, isArray(valueOrArray) ? valueOrArray : [valueOrArray]);
	};

	var toISO = Date.prototype.toISOString;

	var defaultFormat = formats['default'];
	var defaults = {
	    addQueryPrefix: false,
	    allowDots: false,
	    charset: 'utf-8',
	    charsetSentinel: false,
	    delimiter: '&',
	    encode: true,
	    encoder: utils.encode,
	    encodeValuesOnly: false,
	    format: defaultFormat,
	    formatter: formats.formatters[defaultFormat],
	    // deprecated
	    indices: false,
	    serializeDate: function serializeDate(date) {
	        return toISO.call(date);
	    },
	    skipNulls: false,
	    strictNullHandling: false
	};

	var isNonNullishPrimitive = function isNonNullishPrimitive(v) {
	    return typeof v === 'string'
	        || typeof v === 'number'
	        || typeof v === 'boolean'
	        || typeof v === 'symbol'
	        || typeof v === 'bigint';
	};

	var sentinel = {};

	var stringify = function stringify(
	    object,
	    prefix,
	    generateArrayPrefix,
	    commaRoundTrip,
	    strictNullHandling,
	    skipNulls,
	    encoder,
	    filter,
	    sort,
	    allowDots,
	    serializeDate,
	    format,
	    formatter,
	    encodeValuesOnly,
	    charset,
	    sideChannel
	) {
	    var obj = object;

	    var tmpSc = sideChannel;
	    var step = 0;
	    var findFlag = false;
	    while ((tmpSc = tmpSc.get(sentinel)) !== void undefined && !findFlag) {
	        // Where object last appeared in the ref tree
	        var pos = tmpSc.get(object);
	        step += 1;
	        if (typeof pos !== 'undefined') {
	            if (pos === step) {
	                throw new RangeError('Cyclic object value');
	            } else {
	                findFlag = true; // Break while
	            }
	        }
	        if (typeof tmpSc.get(sentinel) === 'undefined') {
	            step = 0;
	        }
	    }

	    if (typeof filter === 'function') {
	        obj = filter(prefix, obj);
	    } else if (obj instanceof Date) {
	        obj = serializeDate(obj);
	    } else if (generateArrayPrefix === 'comma' && isArray(obj)) {
	        obj = utils.maybeMap(obj, function (value) {
	            if (value instanceof Date) {
	                return serializeDate(value);
	            }
	            return value;
	        });
	    }

	    if (obj === null) {
	        if (strictNullHandling) {
	            return encoder && !encodeValuesOnly ? encoder(prefix, defaults.encoder, charset, 'key', format) : prefix;
	        }

	        obj = '';
	    }

	    if (isNonNullishPrimitive(obj) || utils.isBuffer(obj)) {
	        if (encoder) {
	            var keyValue = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder, charset, 'key', format);
	            if (generateArrayPrefix === 'comma' && encodeValuesOnly) {
	                var valuesArray = split.call(String(obj), ',');
	                var valuesJoined = '';
	                for (var i = 0; i < valuesArray.length; ++i) {
	                    valuesJoined += (i === 0 ? '' : ',') + formatter(encoder(valuesArray[i], defaults.encoder, charset, 'value', format));
	                }
	                return [formatter(keyValue) + (commaRoundTrip && isArray(obj) && valuesArray.length === 1 ? '[]' : '') + '=' + valuesJoined];
	            }
	            return [formatter(keyValue) + '=' + formatter(encoder(obj, defaults.encoder, charset, 'value', format))];
	        }
	        return [formatter(prefix) + '=' + formatter(String(obj))];
	    }

	    var values = [];

	    if (typeof obj === 'undefined') {
	        return values;
	    }

	    var objKeys;
	    if (generateArrayPrefix === 'comma' && isArray(obj)) {
	        // we need to join elements in
	        objKeys = [{ value: obj.length > 0 ? obj.join(',') || null : void undefined }];
	    } else if (isArray(filter)) {
	        objKeys = filter;
	    } else {
	        var keys = Object.keys(obj);
	        objKeys = sort ? keys.sort(sort) : keys;
	    }

	    var adjustedPrefix = commaRoundTrip && isArray(obj) && obj.length === 1 ? prefix + '[]' : prefix;

	    for (var j = 0; j < objKeys.length; ++j) {
	        var key = objKeys[j];
	        var value = typeof key === 'object' && typeof key.value !== 'undefined' ? key.value : obj[key];

	        if (skipNulls && value === null) {
	            continue;
	        }

	        var keyPrefix = isArray(obj)
	            ? typeof generateArrayPrefix === 'function' ? generateArrayPrefix(adjustedPrefix, key) : adjustedPrefix
	            : adjustedPrefix + (allowDots ? '.' + key : '[' + key + ']');

	        sideChannel.set(object, step);
	        var valueSideChannel = getSideChannel();
	        valueSideChannel.set(sentinel, sideChannel);
	        pushToArray(values, stringify(
	            value,
	            keyPrefix,
	            generateArrayPrefix,
	            commaRoundTrip,
	            strictNullHandling,
	            skipNulls,
	            encoder,
	            filter,
	            sort,
	            allowDots,
	            serializeDate,
	            format,
	            formatter,
	            encodeValuesOnly,
	            charset,
	            valueSideChannel
	        ));
	    }

	    return values;
	};

	var normalizeStringifyOptions = function normalizeStringifyOptions(opts) {
	    if (!opts) {
	        return defaults;
	    }

	    if (opts.encoder !== null && typeof opts.encoder !== 'undefined' && typeof opts.encoder !== 'function') {
	        throw new TypeError('Encoder has to be a function.');
	    }

	    var charset = opts.charset || defaults.charset;
	    if (typeof opts.charset !== 'undefined' && opts.charset !== 'utf-8' && opts.charset !== 'iso-8859-1') {
	        throw new TypeError('The charset option must be either utf-8, iso-8859-1, or undefined');
	    }

	    var format = formats['default'];
	    if (typeof opts.format !== 'undefined') {
	        if (!has.call(formats.formatters, opts.format)) {
	            throw new TypeError('Unknown format option provided.');
	        }
	        format = opts.format;
	    }
	    var formatter = formats.formatters[format];

	    var filter = defaults.filter;
	    if (typeof opts.filter === 'function' || isArray(opts.filter)) {
	        filter = opts.filter;
	    }

	    return {
	        addQueryPrefix: typeof opts.addQueryPrefix === 'boolean' ? opts.addQueryPrefix : defaults.addQueryPrefix,
	        allowDots: typeof opts.allowDots === 'undefined' ? defaults.allowDots : !!opts.allowDots,
	        charset: charset,
	        charsetSentinel: typeof opts.charsetSentinel === 'boolean' ? opts.charsetSentinel : defaults.charsetSentinel,
	        delimiter: typeof opts.delimiter === 'undefined' ? defaults.delimiter : opts.delimiter,
	        encode: typeof opts.encode === 'boolean' ? opts.encode : defaults.encode,
	        encoder: typeof opts.encoder === 'function' ? opts.encoder : defaults.encoder,
	        encodeValuesOnly: typeof opts.encodeValuesOnly === 'boolean' ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
	        filter: filter,
	        format: format,
	        formatter: formatter,
	        serializeDate: typeof opts.serializeDate === 'function' ? opts.serializeDate : defaults.serializeDate,
	        skipNulls: typeof opts.skipNulls === 'boolean' ? opts.skipNulls : defaults.skipNulls,
	        sort: typeof opts.sort === 'function' ? opts.sort : null,
	        strictNullHandling: typeof opts.strictNullHandling === 'boolean' ? opts.strictNullHandling : defaults.strictNullHandling
	    };
	};

	stringify_1 = function (object, opts) {
	    var obj = object;
	    var options = normalizeStringifyOptions(opts);

	    var objKeys;
	    var filter;

	    if (typeof options.filter === 'function') {
	        filter = options.filter;
	        obj = filter('', obj);
	    } else if (isArray(options.filter)) {
	        filter = options.filter;
	        objKeys = filter;
	    }

	    var keys = [];

	    if (typeof obj !== 'object' || obj === null) {
	        return '';
	    }

	    var arrayFormat;
	    if (opts && opts.arrayFormat in arrayPrefixGenerators) {
	        arrayFormat = opts.arrayFormat;
	    } else if (opts && 'indices' in opts) {
	        arrayFormat = opts.indices ? 'indices' : 'repeat';
	    } else {
	        arrayFormat = 'indices';
	    }

	    var generateArrayPrefix = arrayPrefixGenerators[arrayFormat];
	    if (opts && 'commaRoundTrip' in opts && typeof opts.commaRoundTrip !== 'boolean') {
	        throw new TypeError('`commaRoundTrip` must be a boolean, or absent');
	    }
	    var commaRoundTrip = generateArrayPrefix === 'comma' && opts && opts.commaRoundTrip;

	    if (!objKeys) {
	        objKeys = Object.keys(obj);
	    }

	    if (options.sort) {
	        objKeys.sort(options.sort);
	    }

	    var sideChannel = getSideChannel();
	    for (var i = 0; i < objKeys.length; ++i) {
	        var key = objKeys[i];

	        if (options.skipNulls && obj[key] === null) {
	            continue;
	        }
	        pushToArray(keys, stringify(
	            obj[key],
	            key,
	            generateArrayPrefix,
	            commaRoundTrip,
	            options.strictNullHandling,
	            options.skipNulls,
	            options.encode ? options.encoder : null,
	            options.filter,
	            options.sort,
	            options.allowDots,
	            options.serializeDate,
	            options.format,
	            options.formatter,
	            options.encodeValuesOnly,
	            options.charset,
	            sideChannel
	        ));
	    }

	    var joined = keys.join(options.delimiter);
	    var prefix = options.addQueryPrefix === true ? '?' : '';

	    if (options.charsetSentinel) {
	        if (options.charset === 'iso-8859-1') {
	            // encodeURIComponent('&#10003;'), the "numeric entity" representation of a checkmark
	            prefix += 'utf8=%26%2310003%3B&';
	        } else {
	            // encodeURIComponent('✓')
	            prefix += 'utf8=%E2%9C%93&';
	        }
	    }

	    return joined.length > 0 ? prefix + joined : '';
	};
	return stringify_1;
}

var parse$4;
var hasRequiredParse;

function requireParse () {
	if (hasRequiredParse) return parse$4;
	hasRequiredParse = 1;

	var utils = requireUtils();

	var has = Object.prototype.hasOwnProperty;
	var isArray = Array.isArray;

	var defaults = {
	    allowDots: false,
	    allowPrototypes: false,
	    allowSparse: false,
	    arrayLimit: 20,
	    charset: 'utf-8',
	    charsetSentinel: false,
	    comma: false,
	    decoder: utils.decode,
	    delimiter: '&',
	    depth: 5,
	    ignoreQueryPrefix: false,
	    interpretNumericEntities: false,
	    parameterLimit: 1000,
	    parseArrays: true,
	    plainObjects: false,
	    strictNullHandling: false
	};

	var interpretNumericEntities = function (str) {
	    return str.replace(/&#(\d+);/g, function ($0, numberStr) {
	        return String.fromCharCode(parseInt(numberStr, 10));
	    });
	};

	var parseArrayValue = function (val, options) {
	    if (val && typeof val === 'string' && options.comma && val.indexOf(',') > -1) {
	        return val.split(',');
	    }

	    return val;
	};
	var isoSentinel = 'utf8=%26%2310003%3B'; // encodeURIComponent('&#10003;')

	var charsetSentinel = 'utf8=%E2%9C%93'; // encodeURIComponent('✓')

	var parseValues = function parseQueryStringValues(str, options) {
	    var obj = {};
	    var cleanStr = options.ignoreQueryPrefix ? str.replace(/^\?/, '') : str;
	    var limit = options.parameterLimit === Infinity ? undefined : options.parameterLimit;
	    var parts = cleanStr.split(options.delimiter, limit);
	    var skipIndex = -1; // Keep track of where the utf8 sentinel was found
	    var i;

	    var charset = options.charset;
	    if (options.charsetSentinel) {
	        for (i = 0; i < parts.length; ++i) {
	            if (parts[i].indexOf('utf8=') === 0) {
	                if (parts[i] === charsetSentinel) {
	                    charset = 'utf-8';
	                } else if (parts[i] === isoSentinel) {
	                    charset = 'iso-8859-1';
	                }
	                skipIndex = i;
	                i = parts.length; // The eslint settings do not allow break;
	            }
	        }
	    }

	    for (i = 0; i < parts.length; ++i) {
	        if (i === skipIndex) {
	            continue;
	        }
	        var part = parts[i];

	        var bracketEqualsPos = part.indexOf(']=');
	        var pos = bracketEqualsPos === -1 ? part.indexOf('=') : bracketEqualsPos + 1;

	        var key, val;
	        if (pos === -1) {
	            key = options.decoder(part, defaults.decoder, charset, 'key');
	            val = options.strictNullHandling ? null : '';
	        } else {
	            key = options.decoder(part.slice(0, pos), defaults.decoder, charset, 'key');
	            val = utils.maybeMap(
	                parseArrayValue(part.slice(pos + 1), options),
	                function (encodedVal) {
	                    return options.decoder(encodedVal, defaults.decoder, charset, 'value');
	                }
	            );
	        }

	        if (val && options.interpretNumericEntities && charset === 'iso-8859-1') {
	            val = interpretNumericEntities(val);
	        }

	        if (part.indexOf('[]=') > -1) {
	            val = isArray(val) ? [val] : val;
	        }

	        if (has.call(obj, key)) {
	            obj[key] = utils.combine(obj[key], val);
	        } else {
	            obj[key] = val;
	        }
	    }

	    return obj;
	};

	var parseObject = function (chain, val, options, valuesParsed) {
	    var leaf = valuesParsed ? val : parseArrayValue(val, options);

	    for (var i = chain.length - 1; i >= 0; --i) {
	        var obj;
	        var root = chain[i];

	        if (root === '[]' && options.parseArrays) {
	            obj = [].concat(leaf);
	        } else {
	            obj = options.plainObjects ? Object.create(null) : {};
	            var cleanRoot = root.charAt(0) === '[' && root.charAt(root.length - 1) === ']' ? root.slice(1, -1) : root;
	            var index = parseInt(cleanRoot, 10);
	            if (!options.parseArrays && cleanRoot === '') {
	                obj = { 0: leaf };
	            } else if (
	                !isNaN(index)
	                && root !== cleanRoot
	                && String(index) === cleanRoot
	                && index >= 0
	                && (options.parseArrays && index <= options.arrayLimit)
	            ) {
	                obj = [];
	                obj[index] = leaf;
	            } else if (cleanRoot !== '__proto__') {
	                obj[cleanRoot] = leaf;
	            }
	        }

	        leaf = obj;
	    }

	    return leaf;
	};

	var parseKeys = function parseQueryStringKeys(givenKey, val, options, valuesParsed) {
	    if (!givenKey) {
	        return;
	    }
	    var key = options.allowDots ? givenKey.replace(/\.([^.[]+)/g, '[$1]') : givenKey;

	    var brackets = /(\[[^[\]]*])/;
	    var child = /(\[[^[\]]*])/g;

	    var segment = options.depth > 0 && brackets.exec(key);
	    var parent = segment ? key.slice(0, segment.index) : key;

	    var keys = [];
	    if (parent) {
	        if (!options.plainObjects && has.call(Object.prototype, parent)) {
	            if (!options.allowPrototypes) {
	                return;
	            }
	        }

	        keys.push(parent);
	    }

	    var i = 0;
	    while (options.depth > 0 && (segment = child.exec(key)) !== null && i < options.depth) {
	        i += 1;
	        if (!options.plainObjects && has.call(Object.prototype, segment[1].slice(1, -1))) {
	            if (!options.allowPrototypes) {
	                return;
	            }
	        }
	        keys.push(segment[1]);
	    }

	    // If there's a remainder, just add whatever is left

	    if (segment) {
	        keys.push('[' + key.slice(segment.index) + ']');
	    }

	    return parseObject(keys, val, options, valuesParsed);
	};

	var normalizeParseOptions = function normalizeParseOptions(opts) {
	    if (!opts) {
	        return defaults;
	    }

	    if (opts.decoder !== null && opts.decoder !== undefined && typeof opts.decoder !== 'function') {
	        throw new TypeError('Decoder has to be a function.');
	    }

	    if (typeof opts.charset !== 'undefined' && opts.charset !== 'utf-8' && opts.charset !== 'iso-8859-1') {
	        throw new TypeError('The charset option must be either utf-8, iso-8859-1, or undefined');
	    }
	    var charset = typeof opts.charset === 'undefined' ? defaults.charset : opts.charset;

	    return {
	        allowDots: typeof opts.allowDots === 'undefined' ? defaults.allowDots : !!opts.allowDots,
	        allowPrototypes: typeof opts.allowPrototypes === 'boolean' ? opts.allowPrototypes : defaults.allowPrototypes,
	        allowSparse: typeof opts.allowSparse === 'boolean' ? opts.allowSparse : defaults.allowSparse,
	        arrayLimit: typeof opts.arrayLimit === 'number' ? opts.arrayLimit : defaults.arrayLimit,
	        charset: charset,
	        charsetSentinel: typeof opts.charsetSentinel === 'boolean' ? opts.charsetSentinel : defaults.charsetSentinel,
	        comma: typeof opts.comma === 'boolean' ? opts.comma : defaults.comma,
	        decoder: typeof opts.decoder === 'function' ? opts.decoder : defaults.decoder,
	        delimiter: typeof opts.delimiter === 'string' || utils.isRegExp(opts.delimiter) ? opts.delimiter : defaults.delimiter,
	        // eslint-disable-next-line no-implicit-coercion, no-extra-parens
	        depth: (typeof opts.depth === 'number' || opts.depth === false) ? +opts.depth : defaults.depth,
	        ignoreQueryPrefix: opts.ignoreQueryPrefix === true,
	        interpretNumericEntities: typeof opts.interpretNumericEntities === 'boolean' ? opts.interpretNumericEntities : defaults.interpretNumericEntities,
	        parameterLimit: typeof opts.parameterLimit === 'number' ? opts.parameterLimit : defaults.parameterLimit,
	        parseArrays: opts.parseArrays !== false,
	        plainObjects: typeof opts.plainObjects === 'boolean' ? opts.plainObjects : defaults.plainObjects,
	        strictNullHandling: typeof opts.strictNullHandling === 'boolean' ? opts.strictNullHandling : defaults.strictNullHandling
	    };
	};

	parse$4 = function (str, opts) {
	    var options = normalizeParseOptions(opts);

	    if (str === '' || str === null || typeof str === 'undefined') {
	        return options.plainObjects ? Object.create(null) : {};
	    }

	    var tempObj = typeof str === 'string' ? parseValues(str, options) : str;
	    var obj = options.plainObjects ? Object.create(null) : {};

	    // Iterate over the keys and setup the new object

	    var keys = Object.keys(tempObj);
	    for (var i = 0; i < keys.length; ++i) {
	        var key = keys[i];
	        var newObj = parseKeys(key, tempObj[key], options, typeof str === 'string');
	        obj = utils.merge(obj, newObj, options);
	    }

	    if (options.allowSparse === true) {
	        return obj;
	    }

	    return utils.compact(obj);
	};
	return parse$4;
}

var lib$1;
var hasRequiredLib;

function requireLib () {
	if (hasRequiredLib) return lib$1;
	hasRequiredLib = 1;

	var stringify = requireStringify();
	var parse = requireParse();
	var formats = requireFormats();

	lib$1 = {
	    formats: formats,
	    parse: parse,
	    stringify: stringify
	};
	return lib$1;
}

var urlencoded_1;
var hasRequiredUrlencoded;

function requireUrlencoded () {
	if (hasRequiredUrlencoded) return urlencoded_1;
	hasRequiredUrlencoded = 1;

	var bytes = requireBytes();
	var contentType = requireContentType();
	var createError = requireHttpErrors();
	var debug = requireSrc()('body-parser:urlencoded');
	var deprecate = depd_1('body-parser');
	var read = requireRead();
	var typeis = requireTypeIs();

	urlencoded_1 = urlencoded;

	var parsers = Object.create(null);

	function urlencoded (options) {
	  var opts = options || {};

	  // notice because option default will flip in next major
	  if (opts.extended === undefined) {
	    deprecate('undefined extended: provide extended option');
	  }

	  var extended = opts.extended !== false;
	  var inflate = opts.inflate !== false;
	  var limit = typeof opts.limit !== 'number'
	    ? bytes.parse(opts.limit || '100kb')
	    : opts.limit;
	  var type = opts.type || 'application/x-www-form-urlencoded';
	  var verify = opts.verify || false;

	  if (verify !== false && typeof verify !== 'function') {
	    throw new TypeError('option verify must be function')
	  }

	  // create the appropriate query parser
	  var queryparse = extended
	    ? extendedparser(opts)
	    : simpleparser(opts);

	  // create the appropriate type checking function
	  var shouldParse = typeof type !== 'function'
	    ? typeChecker(type)
	    : type;

	  function parse (body) {
	    return body.length
	      ? queryparse(body)
	      : {}
	  }

	  return function urlencodedParser (req, res, next) {
	    if (req._body) {
	      debug('body already parsed');
	      next();
	      return
	    }

	    req.body = req.body || {};

	    // skip requests without bodies
	    if (!typeis.hasBody(req)) {
	      debug('skip empty body');
	      next();
	      return
	    }

	    debug('content-type %j', req.headers['content-type']);

	    // determine if request should be parsed
	    if (!shouldParse(req)) {
	      debug('skip parsing');
	      next();
	      return
	    }

	    // assert charset
	    var charset = getCharset(req) || 'utf-8';
	    if (charset !== 'utf-8') {
	      debug('invalid charset');
	      next(createError(415, 'unsupported charset "' + charset.toUpperCase() + '"', {
	        charset: charset,
	        type: 'charset.unsupported'
	      }));
	      return
	    }

	    // read
	    read(req, res, next, parse, debug, {
	      debug: debug,
	      encoding: charset,
	      inflate: inflate,
	      limit: limit,
	      verify: verify
	    });
	  }
	}

	function extendedparser (options) {
	  var parameterLimit = options.parameterLimit !== undefined
	    ? options.parameterLimit
	    : 1000;
	  var parse = parser('qs');

	  if (isNaN(parameterLimit) || parameterLimit < 1) {
	    throw new TypeError('option parameterLimit must be a positive number')
	  }

	  if (isFinite(parameterLimit)) {
	    parameterLimit = parameterLimit | 0;
	  }

	  return function queryparse (body) {
	    var paramCount = parameterCount(body, parameterLimit);

	    if (paramCount === undefined) {
	      debug('too many parameters');
	      throw createError(413, 'too many parameters', {
	        type: 'parameters.too.many'
	      })
	    }

	    var arrayLimit = Math.max(100, paramCount);

	    debug('parse extended urlencoding');
	    return parse(body, {
	      allowPrototypes: true,
	      arrayLimit: arrayLimit,
	      depth: Infinity,
	      parameterLimit: parameterLimit
	    })
	  }
	}

	function getCharset (req) {
	  try {
	    return (contentType.parse(req).parameters.charset || '').toLowerCase()
	  } catch (e) {
	    return undefined
	  }
	}

	function parameterCount (body, limit) {
	  var count = 0;
	  var index = 0;

	  while ((index = body.indexOf('&', index)) !== -1) {
	    count++;
	    index++;

	    if (count === limit) {
	      return undefined
	    }
	  }

	  return count
	}
	
	function parser (name) {
	  var mod = parsers[name];

	  if (mod !== undefined) {
	    return mod.parse
	  }

	  // this uses a switch for static require analysis
	  switch (name) {
	    case 'qs':
	      mod = requireLib();
	      break
	    case 'querystring':
	      mod = require$$8;
	      break
	  }

	  parsers[name] = mod;

	  return mod.parse
	}

	function simpleparser (options) {
	  var parameterLimit = options.parameterLimit !== undefined
	    ? options.parameterLimit
	    : 1000;
	  var parse = parser('querystring');

	  if (isNaN(parameterLimit) || parameterLimit < 1) {
	    throw new TypeError('option parameterLimit must be a positive number')
	  }

	  if (isFinite(parameterLimit)) {
	    parameterLimit = parameterLimit | 0;
	  }

	  return function queryparse (body) {
	    var paramCount = parameterCount(body, parameterLimit);

	    if (paramCount === undefined) {
	      debug('too many parameters');
	      throw createError(413, 'too many parameters', {
	        type: 'parameters.too.many'
	      })
	    }

	    debug('parse urlencoding');
	    return parse(body, undefined, undefined, { maxKeys: parameterLimit })
	  }
	}
	function typeChecker (type) {
	  return function checkType (req) {
	    return Boolean(typeis(req, type))
	  }
	}
	return urlencoded_1;
}

(function (module, exports) {

	var deprecate = depd_1('body-parser');

	var parsers = Object.create(null);

	exports = module.exports = deprecate.function(bodyParser,
	  'bodyParser: use individual json/urlencoded middlewares');

	Object.defineProperty(exports, 'json', {
	  configurable: true,
	  enumerable: true,
	  get: createParserGetter('json')
	});

	Object.defineProperty(exports, 'raw', {
	  configurable: true,
	  enumerable: true,
	  get: createParserGetter('raw')
	});

	Object.defineProperty(exports, 'text', {
	  configurable: true,
	  enumerable: true,
	  get: createParserGetter('text')
	});

	Object.defineProperty(exports, 'urlencoded', {
	  configurable: true,
	  enumerable: true,
	  get: createParserGetter('urlencoded')
	});

	function bodyParser (options) {
	  // use default type for parsers
	  var opts = Object.create(options || null, {
	    type: {
	      configurable: true,
	      enumerable: true,
	      value: undefined,
	      writable: true
	    }
	  });

	  var _urlencoded = exports.urlencoded(opts);
	  var _json = exports.json(opts);

	  return function bodyParser (req, res, next) {
	    _json(req, res, function (err) {
	      if (err) return next(err)
	      _urlencoded(req, res, next);
	    });
	  }
	}

	function createParserGetter (name) {
	  return function get () {
	    return loadParser(name)
	  }
	}

	function loadParser (parserName) {
	  var parser = parsers[parserName];

	  if (parser !== undefined) {
	    return parser
	  }

	  // this uses a switch for static require analysis
	  switch (parserName) {
	    case 'json':
	      parser = requireJson();
	      break
	    case 'raw':
	      parser = requireRaw();
	      break
	    case 'text':
	      parser = requireText();
	      break
	    case 'urlencoded':
	      parser = requireUrlencoded();
	      break
	  }

	  // store to prevent invoking require()
	  return (parsers[parserName] = parser)
	} 
} (bodyParser, bodyParser.exports));

var bodyParserExports = bodyParser.exports;

var lib = {exports: {}};

var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

var objectAssign = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

var vary$1 = {exports: {}};


vary$1.exports = vary;
vary$1.exports.append = append;
 */

var FIELD_NAME_REGEXP = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Append a field to a vary header.
 *
 * @param {String} header
 * @param {String|Array} field
 * @return {String}
 * @public
 */

function append (header, field) {
  if (typeof header !== 'string') {
    throw new TypeError('header argument is required')
  }

  if (!field) {
    throw new TypeError('field argument is required')
  }

  // get fields array
  var fields = !Array.isArray(field)
    ? parse$3(String(field))
    : field;

  // assert on invalid field names
  for (var j = 0; j < fields.length; j++) {
    if (!FIELD_NAME_REGEXP.test(fields[j])) {
      throw new TypeError('field argument contains an invalid header name')
    }
  }

  // existing, unspecified vary
  if (header === '*') {
    return header
  }

  // enumerate current values
  var val = header;
  var vals = parse$3(header.toLowerCase());

  // unspecified vary
  if (fields.indexOf('*') !== -1 || vals.indexOf('*') !== -1) {
    return '*'
  }

  for (var i = 0; i < fields.length; i++) {
    var fld = fields[i].toLowerCase();

    // append value (case-preserving)
    if (vals.indexOf(fld) === -1) {
      vals.push(fld);
      val = val
        ? val + ', ' + fields[i]
        : fields[i];
    }
  }

  return val
}

/**
 * Parse a vary header into an array.
 *
 * @param {String} header
 * @return {Array}
 * @private
 */

function parse$3 (header) {
  var end = 0;
  var list = [];
  var start = 0;

  // gather tokens
  for (var i = 0, len = header.length; i < len; i++) {
    switch (header.charCodeAt(i)) {
      case 0x20: /*   */
        if (start === end) {
          start = end = i + 1;
        }
        break
      case 0x2c: /* , */
        list.push(header.substring(start, end));
        start = end = i + 1;
        break
      default:
        end = i + 1;
        break
    }
  }

  // final token
  list.push(header.substring(start, end));

  return list
}

/**
 * Mark that a request is varied on a header field.
 *
 * @param {Object} res
 * @param {String|Array} field
 * @public
 */

function vary (res, field) {
  if (!res || !res.getHeader || !res.setHeader) {
    // quack quack
    throw new TypeError('res argument is required')
  }

  // get existing header
  var val = res.getHeader('Vary') || '';
  var header = Array.isArray(val)
    ? val.join(', ')
    : String(val);

  // set new header
  if ((val = append(header, field))) {
    res.setHeader('Vary', val);
  }
}

var varyExports = vary$1.exports;

(function () {

  var assign = objectAssign;
  var vary = varyExports;

  var defaults = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
  };

  function isString(s) {
    return typeof s === 'string' || s instanceof String;
  }

  function isOriginAllowed(origin, allowedOrigin) {
    if (Array.isArray(allowedOrigin)) {
      for (var i = 0; i < allowedOrigin.length; ++i) {
        if (isOriginAllowed(origin, allowedOrigin[i])) {
          return true;
        }
      }
      return false;
    } else if (isString(allowedOrigin)) {
      return origin === allowedOrigin;
    } else if (allowedOrigin instanceof RegExp) {
      return allowedOrigin.test(origin);
    } else {
      return !!allowedOrigin;
    }
  }

  function configureOrigin(options, req) {
    var requestOrigin = req.headers.origin,
      headers = [],
      isAllowed;

    if (!options.origin || options.origin === '*') {
      // allow any origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: '*'
      }]);
    } else if (isString(options.origin)) {
      // fixed origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: options.origin
      }]);
      headers.push([{
        key: 'Vary',
        value: 'Origin'
      }]);
    } else {
      isAllowed = isOriginAllowed(requestOrigin, options.origin);
      // reflect origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: isAllowed ? requestOrigin : false
      }]);
      headers.push([{
        key: 'Vary',
        value: 'Origin'
      }]);
    }

    return headers;
  }

  function configureMethods(options) {
    var methods = options.methods;
    if (methods.join) {
      methods = options.methods.join(','); // .methods is an array, so turn it into a string
    }
    return {
      key: 'Access-Control-Allow-Methods',
      value: methods
    };
  }

  function configureCredentials(options) {
    if (options.credentials === true) {
      return {
        key: 'Access-Control-Allow-Credentials',
        value: 'true'
      };
    }
    return null;
  }

  function configureAllowedHeaders(options, req) {
    var allowedHeaders = options.allowedHeaders || options.headers;
    var headers = [];

    if (!allowedHeaders) {
      allowedHeaders = req.headers['access-control-request-headers']; // .headers wasn't specified, so reflect the request headers
      headers.push([{
        key: 'Vary',
        value: 'Access-Control-Request-Headers'
      }]);
    } else if (allowedHeaders.join) {
      allowedHeaders = allowedHeaders.join(','); // .headers is an array, so turn it into a string
    }
    if (allowedHeaders && allowedHeaders.length) {
      headers.push([{
        key: 'Access-Control-Allow-Headers',
        value: allowedHeaders
      }]);
    }

    return headers;
  }

  function configureExposedHeaders(options) {
    var headers = options.exposedHeaders;
    if (!headers) {
      return null;
    } else if (headers.join) {
      headers = headers.join(','); // .headers is an array, so turn it into a string
    }
    if (headers && headers.length) {
      return {
        key: 'Access-Control-Expose-Headers',
        value: headers
      };
    }
    return null;
  }

  function configureMaxAge(options) {
    var maxAge = (typeof options.maxAge === 'number' || options.maxAge) && options.maxAge.toString();
    if (maxAge && maxAge.length) {
      return {
        key: 'Access-Control-Max-Age',
        value: maxAge
      };
    }
    return null;
  }

  function applyHeaders(headers, res) {
    for (var i = 0, n = headers.length; i < n; i++) {
      var header = headers[i];
      if (header) {
        if (Array.isArray(header)) {
          applyHeaders(header, res);
        } else if (header.key === 'Vary' && header.value) {
          vary(res, header.value);
        } else if (header.value) {
          res.setHeader(header.key, header.value);
        }
      }
    }
  }

  function cors(options, req, res, next) {
    var headers = [],
      method = req.method && req.method.toUpperCase && req.method.toUpperCase();

    if (method === 'OPTIONS') {
      // preflight
      headers.push(configureOrigin(options, req));
      headers.push(configureCredentials(options));
      headers.push(configureMethods(options));
      headers.push(configureAllowedHeaders(options, req));
      headers.push(configureMaxAge(options));
      headers.push(configureExposedHeaders(options));
      applyHeaders(headers, res);

      if (options.preflightContinue) {
        next();
      } else {
        // Safari (and potentially other browsers) need content-length 0,
        //   for 204 or they just hang waiting for a body
        res.statusCode = options.optionsSuccessStatus;
        res.setHeader('Content-Length', '0');
        res.end();
      }
    } else {
      // actual response
      headers.push(configureOrigin(options, req));
      headers.push(configureCredentials(options));
      headers.push(configureExposedHeaders(options));
      applyHeaders(headers, res);
      next();
    }
  }

  function middlewareWrapper(o) {
    // if options are static (either via defaults or custom options passed in), wrap in a function
    var optionsCallback = null;
    if (typeof o === 'function') {
      optionsCallback = o;
    } else {
      optionsCallback = function (req, cb) {
        cb(null, o);
      };
    }

    return function corsMiddleware(req, res, next) {
      optionsCallback(req, function (err, options) {
        if (err) {
          next(err);
        } else {
          var corsOptions = assign({}, defaults, options);
          var originCallback = null;
          if (corsOptions.origin && typeof corsOptions.origin === 'function') {
            originCallback = corsOptions.origin;
          } else if (corsOptions.origin) {
            originCallback = function (origin, cb) {
              cb(null, corsOptions.origin);
            };
          }

          if (originCallback) {
            originCallback(req.headers.origin, function (err2, origin) {
              if (err2 || !origin) {
                next(err2);
              } else {
                corsOptions.origin = origin;
                cors(corsOptions, req, res, next);
              }
            });
          } else {
            next();
          }
        }
      });
    };
  }

  // can pass either an options hash, an options delegate, or nothing
  lib.exports = middlewareWrapper;

}());

var libExports = lib.exports;
var cors = /*@__PURE__*/getDefaultExportFromCjs(libExports);

function every (arr, cb) {
	var i=0, len=arr.length;

	for (; i < len; i++) {
		if (!cb(arr[i], i, arr)) {
			return false;
		}
	}

	return true;
}

const SEP = '/';
// Types ~> static, param, any, optional
const STYPE=0, PTYPE=1, ATYPE=2, OTYPE=3;
// Char Codes ~> / : *
const SLASH=47, COLON=58, ASTER=42, QMARK=63;

function strip(str) {
	if (str === SEP) return str;
	(str.charCodeAt(0) === SLASH) && (str=str.substring(1));
	var len = str.length - 1;
	return str.charCodeAt(len) === SLASH ? str.substring(0, len) : str;
}

function split(str) {
	return (str=strip(str)) === SEP ? [SEP] : str.split(SEP);
}

function isMatch(arr, obj, idx) {
	idx = arr[idx];
	return (obj.val === idx && obj.type === STYPE) || (idx === SEP ? obj.type > PTYPE : obj.type !== STYPE && (idx || '').endsWith(obj.end));
}

function match$1(str, all) {
	var i=0, tmp, segs=split(str), len=segs.length, l;
	var fn = isMatch.bind(isMatch, segs);

	for (; i < all.length; i++) {
		tmp = all[i];
		if ((l=tmp.length) === len || (l < len && tmp[l-1].type === ATYPE) || (l > len && tmp[l-1].type === OTYPE)) {
			if (every(tmp, fn)) return tmp;
		}
	}

	return [];
}

function parse$2(str) {
	if (str === SEP) {
		return [{ old:str, type:STYPE, val:str, end:'' }];
	}

	var c, x, t, sfx, nxt=strip(str), i=-1, j=0, len=nxt.length, out=[];

	while (++i < len) {
		c = nxt.charCodeAt(i);

		if (c === COLON) {
			j = i + 1; // begining of param
			t = PTYPE; // set type
			x = 0; // reset mark
			sfx = '';

			while (i < len && nxt.charCodeAt(i) !== SLASH) {
				c = nxt.charCodeAt(i);
				if (c === QMARK) {
					x=i; t=OTYPE;
				} else if (c === 46 && sfx.length === 0) {
					sfx = nxt.substring(x=i);
				}
				i++; // move on
			}

			out.push({
				old: str,
				type: t,
				val: nxt.substring(j, x||i),
				end: sfx
			});

			// shorten string & update pointers
			nxt=nxt.substring(i); len-=i; i=0;

			continue; // loop
		} else if (c === ASTER) {
			out.push({
				old: str,
				type: ATYPE,
				val: nxt.substring(i),
				end: ''
			});
			continue; // loop
		} else {
			j = i;
			while (i < len && nxt.charCodeAt(i) !== SLASH) {
				++i; // skip to next slash
			}
			out.push({
				old: str,
				type: STYPE,
				val: nxt.substring(j, i),
				end: ''
			});
			// shorten string & update pointers
			nxt=nxt.substring(i); len-=i; i=j=0;
		}
	}

	return out;
}

function exec$1(str, arr) {
	var i=0, x, y, segs=split(str), out={};
	for (; i < arr.length; i++) {
		x=segs[i]; y=arr[i];
		if (x === SEP) continue;
		if (x !== void 0 && y.type | 2 === OTYPE) {
			out[ y.val ] = x.replace(y.end, '');
		}
	}
	return out;
}

var matchit = /*#__PURE__*/Object.freeze({
    __proto__: null,
    exec: exec$1,
    match: match$1,
    parse: parse$2
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(matchit);

const { exec, match, parse: parse$1 } = require$$0;

class Trouter {
	constructor(opts) {
		this.opts = opts || {};
		this.routes = {};
		this.handlers = {};

		this.all = this.add.bind(this, '*');
		this.get = this.add.bind(this, 'GET');
		this.head = this.add.bind(this, 'HEAD');
		this.patch = this.add.bind(this, 'PATCH');
		this.options = this.add.bind(this, 'OPTIONS');
    this.connect = this.add.bind(this, 'CONNECT');
		this.delete = this.add.bind(this, 'DELETE');
    this.trace = this.add.bind(this, 'TRACE');
		this.post = this.add.bind(this, 'POST');
		this.put = this.add.bind(this, 'PUT');
	}

	add(method, pattern, ...fns) {
		// Save decoded pattern info
		if (this.routes[method] === void 0) this.routes[method]=[];
		this.routes[method].push(parse$1(pattern));
		// Save route handler(s)
		if (this.handlers[method] === void 0) this.handlers[method]={};
		this.handlers[method][pattern] = fns;
		// Allow chainable
		return this;
	}

	find(method, url) {
		let arr = match(url, this.routes[method] || []);
		if (arr.length === 0) {
			arr = match(url, this.routes[method='*'] || []);
			if (!arr.length) return false;
		}
		return {
			params: exec(url, arr),
			handlers: this.handlers[method][arr[0].old]
		};
	}
}

var trouter = Trouter;

var url = function (req) {
	let url = req.url;
	if (url === void 0) return url;

	let obj = req._parsedUrl;
	if (obj && obj._raw === url) return obj;

	obj = {};
	obj.query = obj.search = null;
	obj.href = obj.path = obj.pathname = url;

	let idx = url.indexOf('?', 1);
	if (idx !== -1) {
		obj.search = url.substring(idx);
		obj.query = obj.search.substring(1);
		obj.pathname = url.substring(0, idx);
	}

	obj._raw = url;

	return (req._parsedUrl = obj);
};

const http = require$$1$3;
const Router = trouter;
const { parse } = require$$8;
const parser = url;

function lead(x) {
	return x.charCodeAt(0) === 47 ? x : ('/' + x);
}

function value(x) {
  let y = x.indexOf('/', 1);
  return y > 1 ? x.substring(0, y) : x;
}

function mutate(str, req) {
	req.url = req.url.substring(str.length) || '/';
	req.path = req.path.substring(str.length) || '/';
}

function onError(err, req, res, next) {
	let code = (res.statusCode = err.code || err.status || 500);
	res.end(err.length && err || err.message || http.STATUS_CODES[code]);
}

class Polka extends Router {
	constructor(opts={}) {
		super(opts);
		this.apps = {};
		this.wares = [];
		this.bwares = {};
		this.parse = parser;
		this.server = opts.server;
		this.handler = this.handler.bind(this);
		this.onError = opts.onError || onError; // catch-all handler
		this.onNoMatch = opts.onNoMatch || this.onError.bind(null, { code:404 });
	}

	add(method, pattern, ...fns) {
		let base = lead(value(pattern));
		if (this.apps[base] !== void 0) throw new Error(`Cannot mount ".${method.toLowerCase()}('${lead(pattern)}')" because a Polka application at ".use('${base}')" already exists! You should move this handler into your Polka application instead.`);
		return super.add(method, pattern, ...fns);
	}

	use(base, ...fns) {
		if (typeof base === 'function') {
			this.wares = this.wares.concat(base, fns);
		} else if (base === '/') {
			this.wares = this.wares.concat(fns);
		} else {
			base = lead(base);
			fns.forEach(fn => {
				if (fn instanceof Polka) {
					this.apps[base] = fn;
				} else {
					let arr = this.bwares[base] || [];
					arr.length > 0 || arr.push((r, _, nxt) => (mutate(base, r),nxt()));
					this.bwares[base] = arr.concat(fn);
				}
			});
		}
		return this; // chainable
	}

	listen() {
		(this.server = this.server || http.createServer()).on('request', this.handler);
		this.server.listen.apply(this.server, arguments);
		return this;
	}

	handler(req, res, info) {
		info = info || this.parse(req);
		let fns=[], arr=this.wares, obj=this.find(req.method, info.pathname);
		req.originalUrl = req.originalUrl || req.url;
		let base = value(req.path = info.pathname);
		if (this.bwares[base] !== void 0) {
			arr = arr.concat(this.bwares[base]);
		}
		if (obj) {
			fns = obj.handlers;
			req.params = obj.params;
		} else if (this.apps[base] !== void 0) {
			mutate(base, req); info.pathname=req.path; //=> updates
			fns.push(this.apps[base].handler.bind(null, req, res, info));
		} else if (fns.length === 0) {
			fns.push(this.onNoMatch);
		}
		req.search = info.search;
		req.query = parse(info.query);
		let i=0, len=arr.length, num=fns.length;
		if (len === i && num === 1) return fns[0](req, res);
		let next = err => err ? this.onError(err, req, res, next) : loop();
		let loop = _ => res.finished || (i < len) && arr[i++](req, res, next);
		arr = arr.concat(fns);
		len += num;
		loop(); // init
	}
}

var polka = opts => new Polka(opts);

var polka$1 = /*@__PURE__*/getDefaultExportFromCjs(polka);

class ProviderClass extends EventEmitterClass {
    /**
     * Constructs a ProviderClass instance.
     */
    constructor() {
        super(...arguments);
        /**
         * Bot name identifier.
         * @type {string}
         */
        this.idBotName = 'bot';
        /**
         * Context bot identifier.
         * @type {string}
         */
        this.idCtxBot = 'id-ctx-bot';
		this.methods = {};
        /**
         * Initialize HTTP server and vendor.
         * @public
         * @param {number} port - Port number.
         * @param {Pick<BotCtxMiddlewareOptions, 'blacklist'>} opts - Middleware options.
         * @returns {void}
         */
        this.initAll = (port, opts) => {
            // this.globalVendorArgs.port = port;
            this.methods = {
                sendMessage: this.sendMessage,
                provider: this,
				extensions: opts.extensions,
                blacklist: opts.blacklist,
                state: opts.state,
                globalState: opts.globalState,
                dispatch: (customEvent, payload) => {
                    this.emit('message', {
                        ...payload,
                        body: setEvent(customEvent),
                        name: payload.name,
                        from: removePlus(payload.from),
                    });
                },
            };
            this.initVendor()
                .then((v) => this.listenOnEvents(v))
                .then(() => {
                // this.beforeHttpServerInit();
                // this.start(methods, (routes) => {
                    this.emit('notice', {
                        title: '🛜  HTTP Server ON ',
                        instructions: 'routes',
                    });
                    // this.afterHttpServerInit();
                // });
            });
            return;
        };
        // this.server = this.buildHTTPServer();
    }
    /**
     * Listen on vendor events.
     * @protected
     * @param {{ on: any, [key: string]: any }} vendor - Vendor instance.
     * @returns {void}
     */
    listenOnEvents(vendor) {
        if (!vendor) {
            console.log(`Vendor should not return empty funcion listenOnEvents en bot`);
			return
        }
        if (!this.vendor) {
            this.vendor = vendor;
        }
        const listEvents = this.busEvents();
        for (const { event, func } of listEvents) {
            vendor.on(event, func);
        }
    }
    /**
     * Start the HTTP server.
     * @public
     * @param {BotCtxMiddleware} vendor - Bot context middleware.
     * @param {(arg?: any) => void} [cb=() => null] - Callback function.
     * @returns {void}
     */
    start(vendor, cb = () => null) {
        this.server.use(async (req, _, next) => {
            req[this.idCtxBot] = vendor;
            req[this.idBotName] = this.globalVendorArgs.name ?? 'bot';
            if (req[this.idCtxBot])
                return next();
            return next();
        });
        const routes = this.getListRoutes(this.server).join('\n');
        this.server.listen(this.globalVendorArgs.port, cb(routes));
    }
    /**
     * Stop the HTTP server.
     * @public
     * @returns {Promise<void>} A promise indicating the completion of server shutdown.
     */
    stop() {
        return new Promise((resolve, reject) => {
            this.server.server.close((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * Handle context middleware.
     * @public
     * @param {Function} ctxPolka - Context polka function.
     * @returns {Function} Request handler function.
     */
    inHandleCtx(ctxPolka) {
        return (req, res) => {
            const bot = this.methods ?? undefined; //req[this.idCtxBot];
            const responseError = (res) => {
                const jsonRaw = {
                    error: `You must first log in by scanning the qr code to be able to use this functionality.`,
                    docs: `https://builderbot.vercel.app/errors`,
                    code: `100`,
                };
                console.log(jsonRaw);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                const jsonBody = JSON.stringify(jsonRaw);
                return res.end(jsonBody);
            };
            try {
                ctxPolka(bot, req, res).catch(() => responseError(res));
            }
            catch (err) {
                return responseError(res);
            }
        };
    }
    /**
     * Get list of routes registered on the server.
     * @public
     * @param {Polka} app - Polka application instance.
     * @returns {string[]} Array of route definitions.
     */
    getListRoutes(app) {
        try {
            const list = app.routes;
            const methodKeys = Object.keys(list);
            const parseListRoutes = methodKeys.reduce((prev, current) => {
                const routesForMethod = list[current].flat(2).map((i) => ({ method: current, path: i.old }));
                prev = prev.concat(routesForMethod);
                return prev;
            }, []);
            const unique = parseListRoutes.map((r) => `[${r.method}]: http://localhost:${this.globalVendorArgs.port}${r.path}`);
            return [...new Set(unique)];
        }
        catch (e) {
            console.log(`[Error]:`, e);
            return [];
        }
    }
    /**
     * Build the HTTP server.
     * @public
     * @returns {Polka} Polka instance.
     */
    buildHTTPServer() {
        return polka$1()
            .use(cors())
            .use(bodyParserExports.urlencoded({ extended: true }))
            .use(bodyParserExports.json());
    }
    /**
     * Get instance of the vendor.
     * @public
     * @returns {Vendor} Vendor instance.
     */
    getInstance() {
        return this.vendor;
    }	
}

const createBot = async ({ flow, database, provider }, args) => {
    const defaultArgs = {
        blackList: [],
        listEvents: LIST_ALL,
        delay: 0,
        globalState: {},
        extensions: [],
        queue: {
            timeout: 50000,
            concurrencyLimit: 15,
        },
    };
    const combinedArgs = {
        ...defaultArgs,
        ...args,
    };
    return new CoreClass(flow, database, provider, combinedArgs);
};

const createFlow = (args) => {
    return new FlowClass(args);
};

/**
 * Crear instancia de clase Provider
 * Depdendiendo del Provider puedes pasar argumentos
 * Ver Documentacion
 */
const createProvider = (providerClass, args = null) => {
    const providerInstance = new providerClass(args);
    return providerInstance;
};

exports.CoreClass = CoreClass;
exports.EVENTS = LIST_ALL;
exports.EventEmitterClass = EventEmitterClass;
exports.MemoryDB = MemoryDB;
exports.ProviderClass = ProviderClass;
exports.addAnswer = _addAnswer;
exports.addKeyword = addKeyword;
exports.createBot = createBot;
exports.createFlow = createFlow;
exports.createProvider = createProvider;
exports.utils = index;
