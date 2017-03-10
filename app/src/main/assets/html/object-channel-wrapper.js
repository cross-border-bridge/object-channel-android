require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
"use strict";
var dc = require("@cross-border-bridge/data-channel");
var fc = require("@cross-border-bridge/function-channel");
var oc = require("@cross-border-bridge/object-channel");
var ObjectChannelWrapper = (function () {
    function ObjectChannelWrapper(dataBus) {
        this._dataBus = dataBus;
        this._dataChannel = new dc.DataChannel(this._dataBus);
        this._functionChannel = new fc.FunctionChannel(this._dataChannel);
        this._objectChannel = new oc.ObjectChannel(this._functionChannel);
    }
    ObjectChannelWrapper.prototype.bind = function (classFunction) {
        if (!this._objectChannel)
            return;
        this._objectChannel.bind(classFunction);
    };
    ObjectChannelWrapper.prototype.unbind = function (classFunction) {
        if (!this._objectChannel)
            return;
        this._objectChannel.unbind(classFunction);
    };
    ObjectChannelWrapper.prototype.create = function (className, args, callback, timeout) {
        if (!this._objectChannel)
            return;
        this._objectChannel.create(className, args, callback, timeout);
    };
    ObjectChannelWrapper.prototype.destroy = function () {
        this._objectChannel.destroy();
        this._objectChannel = undefined;
        this._functionChannel.destroy();
        this._functionChannel = undefined;
        this._dataChannel.destroy();
        this._dataChannel = undefined;
        this._dataBus = undefined;
    };
    ObjectChannelWrapper.prototype.destroyed = function () {
        return !this._objectChannel;
    };
    return ObjectChannelWrapper;
}());
exports.ObjectChannelWrapper = ObjectChannelWrapper;

},{"@cross-border-bridge/data-channel":3,"@cross-border-bridge/function-channel":5,"@cross-border-bridge/object-channel":10}],2:[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/**
 * データ種別コード
 */
var DATA_TYPE_PUSH = 1;
var DATA_TYPE_REQUEST = 2;
var DATA_TYPE_RESPONSE = 3;
var DATA_TYPE_ERROR = 4;
/**
 * DataChannel内部エラー
 */
var DataChannelError = (function (_super) {
    __extends(DataChannelError, _super);
    function DataChannelError() {
        _super.apply(this, arguments);
    }
    return DataChannelError;
})(Error);
exports.DataChannelError = DataChannelError;
/**
 * DataBus上で単純なリクエスト＆レスポンス機構を提供する。
 */
var DataChannel = (function () {
    function DataChannel(dataBus) {
        this._handler = undefined;
        this._handlers = [];
        this._tagCount = 0;
        this._waitingCallbacks = {};
        this._timeoutObjects = {};
        this._dataBus = dataBus;
    }
    /**
     * DataChannelを破棄する際に実行する。
     * このメソッドを実行するとすべてのハンドラが解放され、レスポンス待ちの処理についてはエラーが返る。
     */
    DataChannel.prototype.destroy = function () {
        var _this = this;
        if (!this._dataBus)
            return;
        this.unregister();
        this._dataBus = undefined;
        this._handlers = undefined;
        Object.keys(this._waitingCallbacks).forEach(function (tag) {
            var error = new Error("plugin channel destroyed.");
            error.type = "Closed";
            _this.processCallback(tag, error);
        });
        this._waitingCallbacks = undefined;
    };
    /**
     * このDataChannelが既に破棄されたかどうかを返す
     *
     * @return 破棄されていればtrue、されていなければfalse
     */
    DataChannel.prototype.destroyed = function () {
        return !this._dataBus;
    };
    /**
     * メッセージハンドラの登録を行う
     *
     * @param handler メッセージ受信時に実行されるハンドラ
     * @return ハンドラID
     */
    DataChannel.prototype.addHandler = function (handler) {
        if (!Object.keys(this._handlers).length) {
            this.register();
        }
        if (this._handlers.indexOf(handler) === -1) {
            this._handlers.push(handler);
        }
    };
    /**
     * メッセージハンドラの解除を行う
     *
     * @param handlerId ハンドラ登録時に取得したハンドラID
     */
    DataChannel.prototype.removeHandler = function (handler) {
        this._handlers = this._handlers.filter(function (h) { return h !== handler; });
        if (!Object.keys(this._handlers).length) {
            this.unregister();
        }
    };
    /**
     * 登録されているすべてのメッセージハンドラの解除を行う
     */
    DataChannel.prototype.removeAllHandlers = function () {
        if (!Object.keys(this._handlers).length)
            return;
        this._handlers = [];
        this.unregister();
    };
    /**
     * メッセージの送信を行う。
     *
     * @param packet メッセージの実データ。フォーマットによって内容は自由に定義できる
     * @param callback メッセージに対してのレスポンスを受け取るコールバック。任意指定
     * @param timeout レスポンスを待つ待機時間。待機時間を過ぎるとcallbackにtimeoutエラーが返る。未指定時はタイムアウトしない。
     */
    DataChannel.prototype.send = function (packet, callback, timeout) {
        var _this = this;
        if (timeout === void 0) { timeout = 0; }
        if (callback) {
            this.register();
            var tag = this.acquireTag();
            if (0 < timeout) {
                var timeoutObject = setTimeout(function () {
                    var error = new Error("send timeout.");
                    error.type = "Timeout";
                    _this.processCallback(tag, error);
                }, timeout);
                this._timeoutObjects[tag] = timeoutObject;
            }
            this._waitingCallbacks[tag] = callback;
            this._dataBus.send(DATA_TYPE_REQUEST, [tag, packet]);
        }
        else {
            this._dataBus.send(DATA_TYPE_PUSH, [packet]);
        }
    };
    DataChannel.prototype.register = function () {
        var _this = this;
        if (this._handler)
            return;
        this._handler = function (dataType, data) {
            switch (dataType) {
                case DATA_TYPE_ERROR: {
                    var error = new DataChannelError();
                    error.type = data[1];
                    _this.processCallback(data[0], error);
                    return;
                }
                case DATA_TYPE_RESPONSE:
                    _this.processCallback(data[0], null, data[1]);
                    return;
                case DATA_TYPE_PUSH:
                    _this._handlers.forEach(function (handler) {
                        handler(data[0]);
                    });
                    return;
                case DATA_TYPE_REQUEST: {
                    var responseCallback = function (rpacket) {
                        _this._dataBus.send(DATA_TYPE_RESPONSE, [data[0], rpacket]);
                    };
                    _this._handlers.forEach(function (handler) {
                        handler(data[1], responseCallback);
                    });
                    return;
                }
            }
        };
        this._dataBus.addHandler(this._handler);
    };
    DataChannel.prototype.unregister = function () {
        if (!this._handler)
            return;
        this._dataBus.removeHandler(this._handler);
        this._handler = undefined;
    };
    DataChannel.prototype.processCallback = function (targetTag, error, packet) {
        var callback = this._waitingCallbacks[targetTag];
        if (callback) {
            delete this._waitingCallbacks[targetTag];
            delete this._timeoutObjects[targetTag];
            callback(error, packet);
            return true;
        }
        return false;
    };
    DataChannel.prototype.acquireTag = function () {
        return "c:" + ++this._tagCount;
    };
    return DataChannel;
})();
exports.DataChannel = DataChannel;

},{}],3:[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
var DataChannel_1 = require('./DataChannel');
exports.DataChannel = DataChannel_1.DataChannel;
exports.DataChannelError = DataChannel_1.DataChannelError;

},{"./DataChannel":2}],4:[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
"use strict";
/**
 * data-channel format
 */
var FMT_OMI = 'omi'; // Object Method Invocation
var FMT_EDO = 'edo'; // EncoDed Object
var FMT_ERR = 'err'; // ERRor
/**
 * error-type of function channel
 */
var ERROR_TYPE_OBJECT_NOT_BOUND = 'ObjectNotBound';
var ERROR_TYPE_METHOD_NOT_EXIST = 'MethodNotExist';
var FunctionChannel = (function () {
    /**
     * コンストラクタ (FunctionChannel を生成する)
     *
     * @param dataChannel DataChannel
     */
    function FunctionChannel(dataChannel) {
        this._bindingObjects = {};
        this._dataChannel = dataChannel;
        this._onReceivePacket = this.onReceivePacket.bind(this);
        this._dataChannel.addHandler(this._onReceivePacket);
    }
    /**
     * デストラクタ (FunctionChannel を破棄)
     */
    FunctionChannel.prototype.destroy = function () {
        if (!this._dataChannel)
            return;
        this._dataChannel.removeHandler(this._onReceivePacket);
        this._dataChannel = undefined;
        this._onReceivePacket = undefined;
        this._bindingObjects = {};
    };
    /**
     * 破棄済みか確認する
     *
     * @return 結果（true: 破棄済み, false: 破棄されていない）
     */
    FunctionChannel.prototype.destroyed = function () {
        return !this._dataChannel;
    };
    /**
     * オブジェクト識別子 と オブジェクト を紐付ける
     *
     * @param id オブジェクト識別子
     * @param object オブジェクト
     */
    FunctionChannel.prototype.bind = function (id, object) {
        if (!this._dataChannel)
            return;
        this._bindingObjects[id] = object;
    };
    /**
     * オブジェクト識別子 の紐付けを解除する
     *
     * @param id オブジェクト識別子
     */
    FunctionChannel.prototype.unbind = function (id) {
        if (!this._dataChannel)
            return;
        delete this._bindingObjects[id];
    };
    /**
     * 端方(native側) で bind されているオブジェクトのメソッドを実行する
     *
     * @param id 端方で bind されているオブジェクト識別子
     * @param method 実行するメソッド名
     * @param args 実行するメソッドに指定する引数
     * @param [callback] 実行結果の戻り値を受け取るハンドラ（戻り値が不要な場合は指定してなくよい）
     * @param [timeout] 応答待ちのタイムアウト
     */
    FunctionChannel.prototype.invoke = function (id, method, args, callback, timeout) {
        if (!this._dataChannel)
            return;
        var dcc;
        if (callback) {
            dcc = function (error, packet) {
                if (error) {
                    callback.apply(this, [error]);
                }
                else if (FMT_ERR === packet[0]) {
                    callback.apply(this, [packet[1]]);
                }
                else {
                    callback.apply(this, [undefined, packet[1]]);
                }
            };
        }
        else {
            dcc = undefined;
        }
        this._dataChannel.send([FMT_OMI, [id, method, args]], dcc, timeout);
    };
    FunctionChannel.prototype.onReceivePacket = function (packet, callback) {
        if (!this._dataChannel)
            return;
        if (packet[0] === FMT_OMI) {
            this.dispatchMethodInvocation(packet[1][0], packet[1][1], packet[1][2], callback);
        }
        else {
            console.warn('unknown format', packet[0]);
        }
    };
    FunctionChannel.prototype.dispatchMethodInvocation = function (id, methodName, args, callback) {
        if (!this._bindingObjects[id]) {
            if (callback)
                callback([FMT_ERR, ERROR_TYPE_OBJECT_NOT_BOUND]);
            return;
        }
        if (!this._bindingObjects[id][methodName]) {
            if (callback)
                callback([FMT_ERR, ERROR_TYPE_METHOD_NOT_EXIST]);
            return;
        }
        var result = (_a = this._bindingObjects[id])[methodName].apply(_a, args);
        if (callback)
            callback([FMT_EDO, result]);
        var _a;
    };
    return FunctionChannel;
}());
exports.FunctionChannel = FunctionChannel;

},{}],5:[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
"use strict";
var FunctionChannel_1 = require('./FunctionChannel');
exports.FunctionChannel = FunctionChannel_1.FunctionChannel;

},{"./FunctionChannel":4}],6:[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
"use strict";
var ObjectSpace_1 = require('./ObjectSpace');
var ObjectSpaceFC_1 = require('./ObjectSpaceFC');
var RemoteObject_1 = require('./RemoteObject');
var ObjectChannel = (function () {
    function ObjectChannel(functionChannel, objectSpace) {
        this._functionChannel = functionChannel;
        this._objectSpace = objectSpace ? objectSpace : ObjectChannel._globalObjectSpace;
        this._fc = new ObjectSpaceFC_1.ObjectSpaceFC(this._functionChannel, this._objectSpace);
        this._functionChannel.bind("$obj", this._fc);
    }
    /**
     * 破棄
     */
    ObjectChannel.prototype.destroy = function () {
        if (this.destroyed())
            return;
        this._functionChannel.unbind("$obj");
        this._functionChannel = undefined;
        this._objectSpace = undefined;
    };
    /**
     * 破棄済みかチェック
     *
     * @return 破棄済みの場合 true が返る
     */
    ObjectChannel.prototype.destroyed = function () {
        return !this._functionChannel;
    };
    /**
     * ローカル側のクラスをbind
     *
     * @param classFunction クラスが定義されたfunction
     */
    ObjectChannel.prototype.bind = function (classFunction) {
        if (this.destroyed())
            return;
        this._objectSpace.bindClass(this._getFunctionName(classFunction), classFunction);
    };
    /**
     * ローカル側のbindを解除
     *
     * @param classFunction クラスが定義されたfunctionまたはクラス名
     */
    ObjectChannel.prototype.unbind = function (classFunction) {
        if (this.destroyed())
            return;
        if ("string" === typeof classFunction) {
            this._objectSpace.unbindClass(classFunction);
        }
        else {
            this._objectSpace.unbindClass(this._getFunctionName(classFunction));
        }
    };
    /**
     * リモート側のオブジェクトを生成
     *
     * @param className クラス名
     * @param args コンストラクタに渡す引数
     * @param callback 結果を受け取るコールバック
     * @param [timeout] 応答待ちのタイムアウト
     */
    ObjectChannel.prototype.create = function (className, args, callback, timeout) {
        if (this.destroyed())
            return;
        var _this = this;
        this._functionChannel.invoke("$obj", "create", [className, args], function (error, result) {
            if (error) {
                callback.apply(_this, [error, undefined]);
            }
            else {
                callback.apply(_this, [undefined, new RemoteObject_1.RemoteObject(_this._functionChannel, _this._objectSpace, result)]);
            }
        }, timeout);
    };
    ObjectChannel.prototype._getFunctionName = function (f) {
        return f.name || f.toString().match(/^function\s?([^\s(]*)/)[1];
    };
    ObjectChannel._globalObjectSpace = new ObjectSpace_1.ObjectSpace();
    return ObjectChannel;
}());
exports.ObjectChannel = ObjectChannel;

},{"./ObjectSpace":7,"./ObjectSpaceFC":8,"./RemoteObject":9}],7:[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
"use strict";
var ObjectSpace = (function () {
    function ObjectSpace() {
        this._classes = {};
        this._objects = {};
        this._objectIds = {};
    }
    ObjectSpace.prototype.bindClass = function (className, handler) {
        this._classes[className] = handler;
    };
    ObjectSpace.prototype.unbindClass = function (className) {
        delete this._classes[className];
    };
    ObjectSpace.prototype.create = function (className, args) {
        var objectTag = this._acquireRemoteObjectTag(className);
        if (!this._classes[className]) {
            console.error("class not bind: " + className);
            return;
        }
        this._objects[objectTag] = this._createInstance(this._classes[className], args);
        return objectTag;
    };
    ObjectSpace.prototype.getObject = function (objectTag) {
        return this._objects[objectTag];
    };
    ObjectSpace.prototype.destroy = function (objectTag) {
        var object = this._objects[objectTag];
        if (!object) {
            console.error("object undefined: remote-object=" + objectTag);
            return;
        }
        if (object.destroy) {
            object.destroy();
        }
        else if (object.destructor) {
            object.destructor();
        }
        this._objects[objectTag] = undefined;
    };
    ObjectSpace.prototype._createInstance = function (ctor, args) {
        return new (Function.bind.apply(ctor, [null].concat(args[0])));
    };
    ObjectSpace.prototype._acquireRemoteObjectTag = function (className, objectId) {
        if (!this._objectIds[className]) {
            this._objectIds[className] = 0;
        }
        if (!objectId) {
            objectId = this._objectIds[className] + 1;
            if (!objectId) {
                objectId = 1;
            }
        }
        if (objectId <= this._objectIds[className]) {
            console.error("invalid objectId was specified: " + objectId);
            return null;
        }
        this._objectIds[className] = objectId;
        return className + ":" + objectId;
    };
    return ObjectSpace;
}());
exports.ObjectSpace = ObjectSpace;

},{}],8:[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
"use strict";
var ObjectSpaceFC = (function () {
    function ObjectSpaceFC(functionChannel, objectSpace) {
        this._functionChannel = functionChannel;
        this._objectSpace = objectSpace;
    }
    ObjectSpaceFC.prototype.create = function (className) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var objectTag = this._objectSpace.create(className, args);
        if (!objectTag)
            return undefined;
        var localObject = this._objectSpace.getObject(objectTag);
        this._functionChannel.bind(objectTag, localObject);
        return objectTag;
    };
    ObjectSpaceFC.prototype.destroy = function (object) {
        this._objectSpace.destroy(object);
    };
    return ObjectSpaceFC;
}());
exports.ObjectSpaceFC = ObjectSpaceFC;

},{}],9:[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
"use strict";
/**
 * error-type of object channel
 */
var ERROR_TYPE_CLOSE = 'Close';
var RemoteObject = (function () {
    function RemoteObject(channel, space, tag) {
        this._channel = channel;
        this._space = space;
        this._tag = tag;
        this._destroyed = false;
    }
    /**
     * Native側のメソッドを実行
     *
     * @param method 実行するメソッド名
     * @param [args] 実行するメソッドに渡す引数
     * @param [callback] 結果を受け取るコールバック
     * @param [timeout] 応答待ちのタイムアウト
     * @return メソッドの戻り値
     */
    RemoteObject.prototype.invoke = function (method, args, callback, timeout) {
        if (this._destroyed) {
            if (callback)
                callback.apply(this, ["AlreadyDestroyed"]);
            return;
        }
        this._channel.invoke(this._tag, method, args, callback, timeout);
    };
    /**
     * Native側のオブジェクトを破棄
     */
    RemoteObject.prototype.destroy = function () {
        if (this._destroyed) {
            return;
        }
        this._channel.invoke("$obj", "destroy", [this._tag]);
        this._destroyed = true;
    };
    return RemoteObject;
}());
exports.RemoteObject = RemoteObject;

},{}],10:[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
"use strict";
var ObjectChannel_1 = require('./ObjectChannel');
exports.ObjectChannel = ObjectChannel_1.ObjectChannel;
var ObjectSpace_1 = require('./ObjectSpace');
exports.ObjectSpace = ObjectSpace_1.ObjectSpace;
var RemoteObject_1 = require('./RemoteObject');
exports.RemoteObject = RemoteObject_1.RemoteObject;

},{"./ObjectChannel":6,"./ObjectSpace":7,"./RemoteObject":9}],"@cross-border-bridge/object-channel-wrapper":[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
"use strict";
var ObjectChannelWrapper_1 = require('./ObjectChannelWrapper');
exports.ObjectChannelWrapper = ObjectChannelWrapper_1.ObjectChannelWrapper;

},{"./ObjectChannelWrapper":1}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvT2JqZWN0Q2hhbm5lbFdyYXBwZXIuanMiLCJub2RlX21vZHVsZXMvQGNyb3NzLWJvcmRlci1icmlkZ2UvZGF0YS1jaGFubmVsL2xpYi9EYXRhQ2hhbm5lbC5qcyIsIm5vZGVfbW9kdWxlcy9AY3Jvc3MtYm9yZGVyLWJyaWRnZS9kYXRhLWNoYW5uZWwvbGliL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0Bjcm9zcy1ib3JkZXItYnJpZGdlL2Z1bmN0aW9uLWNoYW5uZWwvbGliL0Z1bmN0aW9uQ2hhbm5lbC5qcyIsIm5vZGVfbW9kdWxlcy9AY3Jvc3MtYm9yZGVyLWJyaWRnZS9mdW5jdGlvbi1jaGFubmVsL2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AY3Jvc3MtYm9yZGVyLWJyaWRnZS9vYmplY3QtY2hhbm5lbC9saWIvT2JqZWN0Q2hhbm5lbC5qcyIsIm5vZGVfbW9kdWxlcy9AY3Jvc3MtYm9yZGVyLWJyaWRnZS9vYmplY3QtY2hhbm5lbC9saWIvT2JqZWN0U3BhY2UuanMiLCJub2RlX21vZHVsZXMvQGNyb3NzLWJvcmRlci1icmlkZ2Uvb2JqZWN0LWNoYW5uZWwvbGliL09iamVjdFNwYWNlRkMuanMiLCJub2RlX21vZHVsZXMvQGNyb3NzLWJvcmRlci1icmlkZ2Uvb2JqZWN0LWNoYW5uZWwvbGliL1JlbW90ZU9iamVjdC5qcyIsIm5vZGVfbW9kdWxlcy9AY3Jvc3MtYm9yZGVyLWJyaWRnZS9vYmplY3QtY2hhbm5lbC9saWIvaW5kZXguanMiLCJsaWIvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25MQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgwqkgMjAxNyBEV0FOR08gQ28uLCBMdGQuXG5cInVzZSBzdHJpY3RcIjtcbnZhciBkYyA9IHJlcXVpcmUoXCJAY3Jvc3MtYm9yZGVyLWJyaWRnZS9kYXRhLWNoYW5uZWxcIik7XG52YXIgZmMgPSByZXF1aXJlKFwiQGNyb3NzLWJvcmRlci1icmlkZ2UvZnVuY3Rpb24tY2hhbm5lbFwiKTtcbnZhciBvYyA9IHJlcXVpcmUoXCJAY3Jvc3MtYm9yZGVyLWJyaWRnZS9vYmplY3QtY2hhbm5lbFwiKTtcbnZhciBPYmplY3RDaGFubmVsV3JhcHBlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gT2JqZWN0Q2hhbm5lbFdyYXBwZXIoZGF0YUJ1cykge1xuICAgICAgICB0aGlzLl9kYXRhQnVzID0gZGF0YUJ1cztcbiAgICAgICAgdGhpcy5fZGF0YUNoYW5uZWwgPSBuZXcgZGMuRGF0YUNoYW5uZWwodGhpcy5fZGF0YUJ1cyk7XG4gICAgICAgIHRoaXMuX2Z1bmN0aW9uQ2hhbm5lbCA9IG5ldyBmYy5GdW5jdGlvbkNoYW5uZWwodGhpcy5fZGF0YUNoYW5uZWwpO1xuICAgICAgICB0aGlzLl9vYmplY3RDaGFubmVsID0gbmV3IG9jLk9iamVjdENoYW5uZWwodGhpcy5fZnVuY3Rpb25DaGFubmVsKTtcbiAgICB9XG4gICAgT2JqZWN0Q2hhbm5lbFdyYXBwZXIucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbiAoY2xhc3NGdW5jdGlvbikge1xuICAgICAgICBpZiAoIXRoaXMuX29iamVjdENoYW5uZWwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX29iamVjdENoYW5uZWwuYmluZChjbGFzc0Z1bmN0aW9uKTtcbiAgICB9O1xuICAgIE9iamVjdENoYW5uZWxXcmFwcGVyLnByb3RvdHlwZS51bmJpbmQgPSBmdW5jdGlvbiAoY2xhc3NGdW5jdGlvbikge1xuICAgICAgICBpZiAoIXRoaXMuX29iamVjdENoYW5uZWwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX29iamVjdENoYW5uZWwudW5iaW5kKGNsYXNzRnVuY3Rpb24pO1xuICAgIH07XG4gICAgT2JqZWN0Q2hhbm5lbFdyYXBwZXIucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uIChjbGFzc05hbWUsIGFyZ3MsIGNhbGxiYWNrLCB0aW1lb3V0KSB7XG4gICAgICAgIGlmICghdGhpcy5fb2JqZWN0Q2hhbm5lbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5fb2JqZWN0Q2hhbm5lbC5jcmVhdGUoY2xhc3NOYW1lLCBhcmdzLCBjYWxsYmFjaywgdGltZW91dCk7XG4gICAgfTtcbiAgICBPYmplY3RDaGFubmVsV3JhcHBlci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5fb2JqZWN0Q2hhbm5lbC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX29iamVjdENoYW5uZWwgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX2Z1bmN0aW9uQ2hhbm5lbC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX2Z1bmN0aW9uQ2hhbm5lbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fZGF0YUNoYW5uZWwuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLl9kYXRhQ2hhbm5lbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fZGF0YUJ1cyA9IHVuZGVmaW5lZDtcbiAgICB9O1xuICAgIE9iamVjdENoYW5uZWxXcmFwcGVyLnByb3RvdHlwZS5kZXN0cm95ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAhdGhpcy5fb2JqZWN0Q2hhbm5lbDtcbiAgICB9O1xuICAgIHJldHVybiBPYmplY3RDaGFubmVsV3JhcHBlcjtcbn0oKSk7XG5leHBvcnRzLk9iamVjdENoYW5uZWxXcmFwcGVyID0gT2JqZWN0Q2hhbm5lbFdyYXBwZXI7XG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNyBEV0FOR08gQ28uLCBMdGQuXG52YXIgX19leHRlbmRzID0gKHRoaXMgJiYgdGhpcy5fX2V4dGVuZHMpIHx8IGZ1bmN0aW9uIChkLCBiKSB7XG4gICAgZm9yICh2YXIgcCBpbiBiKSBpZiAoYi5oYXNPd25Qcm9wZXJ0eShwKSkgZFtwXSA9IGJbcF07XG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xufTtcbi8qKlxuICog44OH44O844K/56iu5Yil44Kz44O844OJXG4gKi9cbnZhciBEQVRBX1RZUEVfUFVTSCA9IDE7XG52YXIgREFUQV9UWVBFX1JFUVVFU1QgPSAyO1xudmFyIERBVEFfVFlQRV9SRVNQT05TRSA9IDM7XG52YXIgREFUQV9UWVBFX0VSUk9SID0gNDtcbi8qKlxuICogRGF0YUNoYW5uZWzlhoXpg6jjgqjjg6njg7xcbiAqL1xudmFyIERhdGFDaGFubmVsRXJyb3IgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xuICAgIF9fZXh0ZW5kcyhEYXRhQ2hhbm5lbEVycm9yLCBfc3VwZXIpO1xuICAgIGZ1bmN0aW9uIERhdGFDaGFubmVsRXJyb3IoKSB7XG4gICAgICAgIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgICByZXR1cm4gRGF0YUNoYW5uZWxFcnJvcjtcbn0pKEVycm9yKTtcbmV4cG9ydHMuRGF0YUNoYW5uZWxFcnJvciA9IERhdGFDaGFubmVsRXJyb3I7XG4vKipcbiAqIERhdGFCdXPkuIrjgafljZjntJTjgarjg6rjgq/jgqjjgrnjg4jvvIbjg6zjgrnjg53jg7PjgrnmqZ/mp4vjgpLmj5DkvpvjgZnjgovjgIJcbiAqL1xudmFyIERhdGFDaGFubmVsID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBEYXRhQ2hhbm5lbChkYXRhQnVzKSB7XG4gICAgICAgIHRoaXMuX2hhbmRsZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX2hhbmRsZXJzID0gW107XG4gICAgICAgIHRoaXMuX3RhZ0NvdW50ID0gMDtcbiAgICAgICAgdGhpcy5fd2FpdGluZ0NhbGxiYWNrcyA9IHt9O1xuICAgICAgICB0aGlzLl90aW1lb3V0T2JqZWN0cyA9IHt9O1xuICAgICAgICB0aGlzLl9kYXRhQnVzID0gZGF0YUJ1cztcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGF0YUNoYW5uZWzjgpLnoLTmo4TjgZnjgovpmpvjgavlrp/ooYzjgZnjgovjgIJcbiAgICAgKiDjgZPjga7jg6Hjgr3jg4Pjg4njgpLlrp/ooYzjgZnjgovjgajjgZnjgbnjgabjga7jg4/jg7Pjg4njg6njgYzop6PmlL7jgZXjgozjgIHjg6zjgrnjg53jg7PjgrnlvoXjgaHjga7lh6bnkIbjgavjgaTjgYTjgabjga/jgqjjg6njg7zjgYzov5TjgovjgIJcbiAgICAgKi9cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhQnVzKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLnVucmVnaXN0ZXIoKTtcbiAgICAgICAgdGhpcy5fZGF0YUJ1cyA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5faGFuZGxlcnMgPSB1bmRlZmluZWQ7XG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMuX3dhaXRpbmdDYWxsYmFja3MpLmZvckVhY2goZnVuY3Rpb24gKHRhZykge1xuICAgICAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKFwicGx1Z2luIGNoYW5uZWwgZGVzdHJveWVkLlwiKTtcbiAgICAgICAgICAgIGVycm9yLnR5cGUgPSBcIkNsb3NlZFwiO1xuICAgICAgICAgICAgX3RoaXMucHJvY2Vzc0NhbGxiYWNrKHRhZywgZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fd2FpdGluZ0NhbGxiYWNrcyA9IHVuZGVmaW5lZDtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOOBk+OBrkRhdGFDaGFubmVs44GM5pei44Gr56C05qOE44GV44KM44Gf44GL44Gp44GG44GL44KS6L+U44GZXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIOegtOajhOOBleOCjOOBpuOBhOOCjOOBsHRydWXjgIHjgZXjgozjgabjgYTjgarjgZHjgozjgbBmYWxzZVxuICAgICAqL1xuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5kZXN0cm95ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAhdGhpcy5fZGF0YUJ1cztcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOODoeODg+OCu+ODvOOCuOODj+ODs+ODieODqeOBrueZu+mMsuOCkuihjOOBhlxuICAgICAqXG4gICAgICogQHBhcmFtIGhhbmRsZXIg44Oh44OD44K744O844K45Y+X5L+h5pmC44Gr5a6f6KGM44GV44KM44KL44OP44Oz44OJ44OpXG4gICAgICogQHJldHVybiDjg4/jg7Pjg4njg6lJRFxuICAgICAqL1xuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5hZGRIYW5kbGVyID0gZnVuY3Rpb24gKGhhbmRsZXIpIHtcbiAgICAgICAgaWYgKCFPYmplY3Qua2V5cyh0aGlzLl9oYW5kbGVycykubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLnJlZ2lzdGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX2hhbmRsZXJzLmluZGV4T2YoaGFuZGxlcikgPT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLl9oYW5kbGVycy5wdXNoKGhhbmRsZXIpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiDjg6Hjg4Pjgrvjg7zjgrjjg4/jg7Pjg4njg6njga7op6PpmaTjgpLooYzjgYZcbiAgICAgKlxuICAgICAqIEBwYXJhbSBoYW5kbGVySWQg44OP44Oz44OJ44Op55m76Yyy5pmC44Gr5Y+W5b6X44GX44Gf44OP44Oz44OJ44OpSURcbiAgICAgKi9cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUucmVtb3ZlSGFuZGxlciA9IGZ1bmN0aW9uIChoYW5kbGVyKSB7XG4gICAgICAgIHRoaXMuX2hhbmRsZXJzID0gdGhpcy5faGFuZGxlcnMuZmlsdGVyKGZ1bmN0aW9uIChoKSB7IHJldHVybiBoICE9PSBoYW5kbGVyOyB9KTtcbiAgICAgICAgaWYgKCFPYmplY3Qua2V5cyh0aGlzLl9oYW5kbGVycykubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLnVucmVnaXN0ZXIoKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgLyoqXG4gICAgICog55m76Yyy44GV44KM44Gm44GE44KL44GZ44G544Gm44Gu44Oh44OD44K744O844K444OP44Oz44OJ44Op44Gu6Kej6Zmk44KS6KGM44GGXG4gICAgICovXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLnJlbW92ZUFsbEhhbmRsZXJzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIU9iamVjdC5rZXlzKHRoaXMuX2hhbmRsZXJzKS5sZW5ndGgpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2hhbmRsZXJzID0gW107XG4gICAgICAgIHRoaXMudW5yZWdpc3RlcigpO1xuICAgIH07XG4gICAgLyoqXG4gICAgICog44Oh44OD44K744O844K444Gu6YCB5L+h44KS6KGM44GG44CCXG4gICAgICpcbiAgICAgKiBAcGFyYW0gcGFja2V0IOODoeODg+OCu+ODvOOCuOOBruWun+ODh+ODvOOCv+OAguODleOCqeODvOODnuODg+ODiOOBq+OCiOOBo+OBpuWGheWuueOBr+iHqueUseOBq+Wumue+qeOBp+OBjeOCi1xuICAgICAqIEBwYXJhbSBjYWxsYmFjayDjg6Hjg4Pjgrvjg7zjgrjjgavlr77jgZfjgabjga7jg6zjgrnjg53jg7PjgrnjgpLlj5fjgZHlj5bjgovjgrPjg7zjg6vjg5Djg4Pjgq/jgILku7vmhI/mjIflrppcbiAgICAgKiBAcGFyYW0gdGltZW91dCDjg6zjgrnjg53jg7PjgrnjgpLlvoXjgaTlvoXmqZ/mmYLplpPjgILlvoXmqZ/mmYLplpPjgpLpgY7jgY7jgovjgahjYWxsYmFja+OBq3RpbWVvdXTjgqjjg6njg7zjgYzov5TjgovjgILmnKrmjIflrprmmYLjga/jgr/jgqTjg6DjgqLjgqbjg4jjgZfjgarjgYTjgIJcbiAgICAgKi9cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uIChwYWNrZXQsIGNhbGxiYWNrLCB0aW1lb3V0KSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIGlmICh0aW1lb3V0ID09PSB2b2lkIDApIHsgdGltZW91dCA9IDA7IH1cbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLnJlZ2lzdGVyKCk7XG4gICAgICAgICAgICB2YXIgdGFnID0gdGhpcy5hY3F1aXJlVGFnKCk7XG4gICAgICAgICAgICBpZiAoMCA8IHRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGltZW91dE9iamVjdCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoXCJzZW5kIHRpbWVvdXQuXCIpO1xuICAgICAgICAgICAgICAgICAgICBlcnJvci50eXBlID0gXCJUaW1lb3V0XCI7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLnByb2Nlc3NDYWxsYmFjayh0YWcsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9LCB0aW1lb3V0KTtcbiAgICAgICAgICAgICAgICB0aGlzLl90aW1lb3V0T2JqZWN0c1t0YWddID0gdGltZW91dE9iamVjdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3dhaXRpbmdDYWxsYmFja3NbdGFnXSA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgdGhpcy5fZGF0YUJ1cy5zZW5kKERBVEFfVFlQRV9SRVFVRVNULCBbdGFnLCBwYWNrZXRdKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGFCdXMuc2VuZChEQVRBX1RZUEVfUFVTSCwgW3BhY2tldF0pO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIGlmICh0aGlzLl9oYW5kbGVyKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9oYW5kbGVyID0gZnVuY3Rpb24gKGRhdGFUeXBlLCBkYXRhKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKGRhdGFUeXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBEQVRBX1RZUEVfRVJST1I6IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVycm9yID0gbmV3IERhdGFDaGFubmVsRXJyb3IoKTtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IudHlwZSA9IGRhdGFbMV07XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLnByb2Nlc3NDYWxsYmFjayhkYXRhWzBdLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FzZSBEQVRBX1RZUEVfUkVTUE9OU0U6XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLnByb2Nlc3NDYWxsYmFjayhkYXRhWzBdLCBudWxsLCBkYXRhWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGNhc2UgREFUQV9UWVBFX1BVU0g6XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLl9oYW5kbGVycy5mb3JFYWNoKGZ1bmN0aW9uIChoYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVyKGRhdGFbMF0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGNhc2UgREFUQV9UWVBFX1JFUVVFU1Q6IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3BvbnNlQ2FsbGJhY2sgPSBmdW5jdGlvbiAocnBhY2tldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX2RhdGFCdXMuc2VuZChEQVRBX1RZUEVfUkVTUE9OU0UsIFtkYXRhWzBdLCBycGFja2V0XSk7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLl9oYW5kbGVycy5mb3JFYWNoKGZ1bmN0aW9uIChoYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVyKGRhdGFbMV0sIHJlc3BvbnNlQ2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fZGF0YUJ1cy5hZGRIYW5kbGVyKHRoaXMuX2hhbmRsZXIpO1xuICAgIH07XG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLnVucmVnaXN0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5faGFuZGxlcilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5fZGF0YUJ1cy5yZW1vdmVIYW5kbGVyKHRoaXMuX2hhbmRsZXIpO1xuICAgICAgICB0aGlzLl9oYW5kbGVyID0gdW5kZWZpbmVkO1xuICAgIH07XG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLnByb2Nlc3NDYWxsYmFjayA9IGZ1bmN0aW9uICh0YXJnZXRUYWcsIGVycm9yLCBwYWNrZXQpIHtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gdGhpcy5fd2FpdGluZ0NhbGxiYWNrc1t0YXJnZXRUYWddO1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl93YWl0aW5nQ2FsbGJhY2tzW3RhcmdldFRhZ107XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fdGltZW91dE9iamVjdHNbdGFyZ2V0VGFnXTtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycm9yLCBwYWNrZXQpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLmFjcXVpcmVUYWcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBcImM6XCIgKyArK3RoaXMuX3RhZ0NvdW50O1xuICAgIH07XG4gICAgcmV0dXJuIERhdGFDaGFubmVsO1xufSkoKTtcbmV4cG9ydHMuRGF0YUNoYW5uZWwgPSBEYXRhQ2hhbm5lbDtcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE3IERXQU5HTyBDby4sIEx0ZC5cbnZhciBEYXRhQ2hhbm5lbF8xID0gcmVxdWlyZSgnLi9EYXRhQ2hhbm5lbCcpO1xuZXhwb3J0cy5EYXRhQ2hhbm5lbCA9IERhdGFDaGFubmVsXzEuRGF0YUNoYW5uZWw7XG5leHBvcnRzLkRhdGFDaGFubmVsRXJyb3IgPSBEYXRhQ2hhbm5lbF8xLkRhdGFDaGFubmVsRXJyb3I7XG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNyBEV0FOR08gQ28uLCBMdGQuXG5cInVzZSBzdHJpY3RcIjtcbi8qKlxuICogZGF0YS1jaGFubmVsIGZvcm1hdFxuICovXG52YXIgRk1UX09NSSA9ICdvbWknOyAvLyBPYmplY3QgTWV0aG9kIEludm9jYXRpb25cbnZhciBGTVRfRURPID0gJ2Vkbyc7IC8vIEVuY29EZWQgT2JqZWN0XG52YXIgRk1UX0VSUiA9ICdlcnInOyAvLyBFUlJvclxuLyoqXG4gKiBlcnJvci10eXBlIG9mIGZ1bmN0aW9uIGNoYW5uZWxcbiAqL1xudmFyIEVSUk9SX1RZUEVfT0JKRUNUX05PVF9CT1VORCA9ICdPYmplY3ROb3RCb3VuZCc7XG52YXIgRVJST1JfVFlQRV9NRVRIT0RfTk9UX0VYSVNUID0gJ01ldGhvZE5vdEV4aXN0JztcbnZhciBGdW5jdGlvbkNoYW5uZWwgPSAoZnVuY3Rpb24gKCkge1xuICAgIC8qKlxuICAgICAqIOOCs+ODs+OCueODiOODqeOCr+OCvyAoRnVuY3Rpb25DaGFubmVsIOOCkueUn+aIkOOBmeOCiylcbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhQ2hhbm5lbCBEYXRhQ2hhbm5lbFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIEZ1bmN0aW9uQ2hhbm5lbChkYXRhQ2hhbm5lbCkge1xuICAgICAgICB0aGlzLl9iaW5kaW5nT2JqZWN0cyA9IHt9O1xuICAgICAgICB0aGlzLl9kYXRhQ2hhbm5lbCA9IGRhdGFDaGFubmVsO1xuICAgICAgICB0aGlzLl9vblJlY2VpdmVQYWNrZXQgPSB0aGlzLm9uUmVjZWl2ZVBhY2tldC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9kYXRhQ2hhbm5lbC5hZGRIYW5kbGVyKHRoaXMuX29uUmVjZWl2ZVBhY2tldCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIOODh+OCueODiOODqeOCr+OCvyAoRnVuY3Rpb25DaGFubmVsIOOCkuegtOajhClcbiAgICAgKi9cbiAgICBGdW5jdGlvbkNoYW5uZWwucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGF0YUNoYW5uZWwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2RhdGFDaGFubmVsLnJlbW92ZUhhbmRsZXIodGhpcy5fb25SZWNlaXZlUGFja2V0KTtcbiAgICAgICAgdGhpcy5fZGF0YUNoYW5uZWwgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX29uUmVjZWl2ZVBhY2tldCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fYmluZGluZ09iamVjdHMgPSB7fTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOegtOajhOa4iOOBv+OBi+eiuuiqjeOBmeOCi1xuICAgICAqXG4gICAgICogQHJldHVybiDntZDmnpzvvIh0cnVlOiDnoLTmo4TmuIjjgb8sIGZhbHNlOiDnoLTmo4TjgZXjgozjgabjgYTjgarjgYTvvIlcbiAgICAgKi9cbiAgICBGdW5jdGlvbkNoYW5uZWwucHJvdG90eXBlLmRlc3Ryb3llZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICF0aGlzLl9kYXRhQ2hhbm5lbDtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOOCquODluOCuOOCp+OCr+ODiOitmOWIpeWtkCDjgagg44Kq44OW44K444Kn44Kv44OIIOOCkue0kOS7mOOBkeOCi1xuICAgICAqXG4gICAgICogQHBhcmFtIGlkIOOCquODluOCuOOCp+OCr+ODiOitmOWIpeWtkFxuICAgICAqIEBwYXJhbSBvYmplY3Qg44Kq44OW44K444Kn44Kv44OIXG4gICAgICovXG4gICAgRnVuY3Rpb25DaGFubmVsLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24gKGlkLCBvYmplY3QpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhQ2hhbm5lbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5fYmluZGluZ09iamVjdHNbaWRdID0gb2JqZWN0O1xuICAgIH07XG4gICAgLyoqXG4gICAgICog44Kq44OW44K444Kn44Kv44OI6K2Y5Yil5a2QIOOBrue0kOS7mOOBkeOCkuino+mZpOOBmeOCi1xuICAgICAqXG4gICAgICogQHBhcmFtIGlkIOOCquODluOCuOOCp+OCr+ODiOitmOWIpeWtkFxuICAgICAqL1xuICAgIEZ1bmN0aW9uQ2hhbm5lbC5wcm90b3R5cGUudW5iaW5kID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGF0YUNoYW5uZWwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9iaW5kaW5nT2JqZWN0c1tpZF07XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiDnq6/mlrkobmF0aXZl5YG0KSDjgacgYmluZCDjgZXjgozjgabjgYTjgovjgqrjg5bjgrjjgqfjgq/jg4jjga7jg6Hjgr3jg4Pjg4njgpLlrp/ooYzjgZnjgotcbiAgICAgKlxuICAgICAqIEBwYXJhbSBpZCDnq6/mlrnjgacgYmluZCDjgZXjgozjgabjgYTjgovjgqrjg5bjgrjjgqfjgq/jg4jorZjliKXlrZBcbiAgICAgKiBAcGFyYW0gbWV0aG9kIOWun+ihjOOBmeOCi+ODoeOCveODg+ODieWQjVxuICAgICAqIEBwYXJhbSBhcmdzIOWun+ihjOOBmeOCi+ODoeOCveODg+ODieOBq+aMh+WumuOBmeOCi+W8leaVsFxuICAgICAqIEBwYXJhbSBbY2FsbGJhY2tdIOWun+ihjOe1kOaenOOBruaIu+OCiuWApOOCkuWPl+OBkeWPluOCi+ODj+ODs+ODieODqe+8iOaIu+OCiuWApOOBjOS4jeimgeOBquWgtOWQiOOBr+aMh+WumuOBl+OBpuOBquOBj+OCiOOBhO+8iVxuICAgICAqIEBwYXJhbSBbdGltZW91dF0g5b+c562U5b6F44Gh44Gu44K/44Kk44Og44Ki44Km44OIXG4gICAgICovXG4gICAgRnVuY3Rpb25DaGFubmVsLnByb3RvdHlwZS5pbnZva2UgPSBmdW5jdGlvbiAoaWQsIG1ldGhvZCwgYXJncywgY2FsbGJhY2ssIHRpbWVvdXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhQ2hhbm5lbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdmFyIGRjYztcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBkY2MgPSBmdW5jdGlvbiAoZXJyb3IsIHBhY2tldCkge1xuICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBbZXJyb3JdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoRk1UX0VSUiA9PT0gcGFja2V0WzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIFtwYWNrZXRbMV1dKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIFt1bmRlZmluZWQsIHBhY2tldFsxXV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkY2MgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGF0YUNoYW5uZWwuc2VuZChbRk1UX09NSSwgW2lkLCBtZXRob2QsIGFyZ3NdXSwgZGNjLCB0aW1lb3V0KTtcbiAgICB9O1xuICAgIEZ1bmN0aW9uQ2hhbm5lbC5wcm90b3R5cGUub25SZWNlaXZlUGFja2V0ID0gZnVuY3Rpb24gKHBhY2tldCwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhQ2hhbm5lbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgaWYgKHBhY2tldFswXSA9PT0gRk1UX09NSSkge1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaE1ldGhvZEludm9jYXRpb24ocGFja2V0WzFdWzBdLCBwYWNrZXRbMV1bMV0sIHBhY2tldFsxXVsyXSwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCd1bmtub3duIGZvcm1hdCcsIHBhY2tldFswXSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIEZ1bmN0aW9uQ2hhbm5lbC5wcm90b3R5cGUuZGlzcGF0Y2hNZXRob2RJbnZvY2F0aW9uID0gZnVuY3Rpb24gKGlkLCBtZXRob2ROYW1lLCBhcmdzLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRoaXMuX2JpbmRpbmdPYmplY3RzW2lkXSkge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKFtGTVRfRVJSLCBFUlJPUl9UWVBFX09CSkVDVF9OT1RfQk9VTkRdKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuX2JpbmRpbmdPYmplY3RzW2lkXVttZXRob2ROYW1lXSkge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKFtGTVRfRVJSLCBFUlJPUl9UWVBFX01FVEhPRF9OT1RfRVhJU1RdKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVzdWx0ID0gKF9hID0gdGhpcy5fYmluZGluZ09iamVjdHNbaWRdKVttZXRob2ROYW1lXS5hcHBseShfYSwgYXJncyk7XG4gICAgICAgIGlmIChjYWxsYmFjaylcbiAgICAgICAgICAgIGNhbGxiYWNrKFtGTVRfRURPLCByZXN1bHRdKTtcbiAgICAgICAgdmFyIF9hO1xuICAgIH07XG4gICAgcmV0dXJuIEZ1bmN0aW9uQ2hhbm5lbDtcbn0oKSk7XG5leHBvcnRzLkZ1bmN0aW9uQ2hhbm5lbCA9IEZ1bmN0aW9uQ2hhbm5lbDtcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE3IERXQU5HTyBDby4sIEx0ZC5cblwidXNlIHN0cmljdFwiO1xudmFyIEZ1bmN0aW9uQ2hhbm5lbF8xID0gcmVxdWlyZSgnLi9GdW5jdGlvbkNoYW5uZWwnKTtcbmV4cG9ydHMuRnVuY3Rpb25DaGFubmVsID0gRnVuY3Rpb25DaGFubmVsXzEuRnVuY3Rpb25DaGFubmVsO1xuIiwiLy8gQ29weXJpZ2h0IMKpIDIwMTcgRFdBTkdPIENvLiwgTHRkLlxuXCJ1c2Ugc3RyaWN0XCI7XG52YXIgT2JqZWN0U3BhY2VfMSA9IHJlcXVpcmUoJy4vT2JqZWN0U3BhY2UnKTtcbnZhciBPYmplY3RTcGFjZUZDXzEgPSByZXF1aXJlKCcuL09iamVjdFNwYWNlRkMnKTtcbnZhciBSZW1vdGVPYmplY3RfMSA9IHJlcXVpcmUoJy4vUmVtb3RlT2JqZWN0Jyk7XG52YXIgT2JqZWN0Q2hhbm5lbCA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gT2JqZWN0Q2hhbm5lbChmdW5jdGlvbkNoYW5uZWwsIG9iamVjdFNwYWNlKSB7XG4gICAgICAgIHRoaXMuX2Z1bmN0aW9uQ2hhbm5lbCA9IGZ1bmN0aW9uQ2hhbm5lbDtcbiAgICAgICAgdGhpcy5fb2JqZWN0U3BhY2UgPSBvYmplY3RTcGFjZSA/IG9iamVjdFNwYWNlIDogT2JqZWN0Q2hhbm5lbC5fZ2xvYmFsT2JqZWN0U3BhY2U7XG4gICAgICAgIHRoaXMuX2ZjID0gbmV3IE9iamVjdFNwYWNlRkNfMS5PYmplY3RTcGFjZUZDKHRoaXMuX2Z1bmN0aW9uQ2hhbm5lbCwgdGhpcy5fb2JqZWN0U3BhY2UpO1xuICAgICAgICB0aGlzLl9mdW5jdGlvbkNoYW5uZWwuYmluZChcIiRvYmpcIiwgdGhpcy5fZmMpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiDnoLTmo4RcbiAgICAgKi9cbiAgICBPYmplY3RDaGFubmVsLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy5kZXN0cm95ZWQoKSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5fZnVuY3Rpb25DaGFubmVsLnVuYmluZChcIiRvYmpcIik7XG4gICAgICAgIHRoaXMuX2Z1bmN0aW9uQ2hhbm5lbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fb2JqZWN0U3BhY2UgPSB1bmRlZmluZWQ7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiDnoLTmo4TmuIjjgb/jgYvjg4Hjgqfjg4Pjgq9cbiAgICAgKlxuICAgICAqIEByZXR1cm4g56C05qOE5riI44G/44Gu5aC05ZCIIHRydWUg44GM6L+U44KLXG4gICAgICovXG4gICAgT2JqZWN0Q2hhbm5lbC5wcm90b3R5cGUuZGVzdHJveWVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gIXRoaXMuX2Z1bmN0aW9uQ2hhbm5lbDtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOODreODvOOCq+ODq+WBtOOBruOCr+ODqeOCueOCkmJpbmRcbiAgICAgKlxuICAgICAqIEBwYXJhbSBjbGFzc0Z1bmN0aW9uIOOCr+ODqeOCueOBjOWumue+qeOBleOCjOOBn2Z1bmN0aW9uXG4gICAgICovXG4gICAgT2JqZWN0Q2hhbm5lbC5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uIChjbGFzc0Z1bmN0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLmRlc3Ryb3llZCgpKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9vYmplY3RTcGFjZS5iaW5kQ2xhc3ModGhpcy5fZ2V0RnVuY3Rpb25OYW1lKGNsYXNzRnVuY3Rpb24pLCBjbGFzc0Z1bmN0aW9uKTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOODreODvOOCq+ODq+WBtOOBrmJpbmTjgpLop6PpmaRcbiAgICAgKlxuICAgICAqIEBwYXJhbSBjbGFzc0Z1bmN0aW9uIOOCr+ODqeOCueOBjOWumue+qeOBleOCjOOBn2Z1bmN0aW9u44G+44Gf44Gv44Kv44Op44K55ZCNXG4gICAgICovXG4gICAgT2JqZWN0Q2hhbm5lbC5wcm90b3R5cGUudW5iaW5kID0gZnVuY3Rpb24gKGNsYXNzRnVuY3Rpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuZGVzdHJveWVkKCkpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGlmIChcInN0cmluZ1wiID09PSB0eXBlb2YgY2xhc3NGdW5jdGlvbikge1xuICAgICAgICAgICAgdGhpcy5fb2JqZWN0U3BhY2UudW5iaW5kQ2xhc3MoY2xhc3NGdW5jdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vYmplY3RTcGFjZS51bmJpbmRDbGFzcyh0aGlzLl9nZXRGdW5jdGlvbk5hbWUoY2xhc3NGdW5jdGlvbikpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiDjg6rjg6Ljg7zjg4jlgbTjga7jgqrjg5bjgrjjgqfjgq/jg4jjgpLnlJ/miJBcbiAgICAgKlxuICAgICAqIEBwYXJhbSBjbGFzc05hbWUg44Kv44Op44K55ZCNXG4gICAgICogQHBhcmFtIGFyZ3Mg44Kz44Oz44K544OI44Op44Kv44K/44Gr5rih44GZ5byV5pWwXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOe1kOaenOOCkuWPl+OBkeWPluOCi+OCs+ODvOODq+ODkOODg+OCr1xuICAgICAqIEBwYXJhbSBbdGltZW91dF0g5b+c562U5b6F44Gh44Gu44K/44Kk44Og44Ki44Km44OIXG4gICAgICovXG4gICAgT2JqZWN0Q2hhbm5lbC5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gKGNsYXNzTmFtZSwgYXJncywgY2FsbGJhY2ssIHRpbWVvdXQpIHtcbiAgICAgICAgaWYgKHRoaXMuZGVzdHJveWVkKCkpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIHRoaXMuX2Z1bmN0aW9uQ2hhbm5lbC5pbnZva2UoXCIkb2JqXCIsIFwiY3JlYXRlXCIsIFtjbGFzc05hbWUsIGFyZ3NdLCBmdW5jdGlvbiAoZXJyb3IsIHJlc3VsdCkge1xuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkoX3RoaXMsIFtlcnJvciwgdW5kZWZpbmVkXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseShfdGhpcywgW3VuZGVmaW5lZCwgbmV3IFJlbW90ZU9iamVjdF8xLlJlbW90ZU9iamVjdChfdGhpcy5fZnVuY3Rpb25DaGFubmVsLCBfdGhpcy5fb2JqZWN0U3BhY2UsIHJlc3VsdCldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdGltZW91dCk7XG4gICAgfTtcbiAgICBPYmplY3RDaGFubmVsLnByb3RvdHlwZS5fZ2V0RnVuY3Rpb25OYW1lID0gZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgcmV0dXJuIGYubmFtZSB8fCBmLnRvU3RyaW5nKCkubWF0Y2goL15mdW5jdGlvblxccz8oW15cXHMoXSopLylbMV07XG4gICAgfTtcbiAgICBPYmplY3RDaGFubmVsLl9nbG9iYWxPYmplY3RTcGFjZSA9IG5ldyBPYmplY3RTcGFjZV8xLk9iamVjdFNwYWNlKCk7XG4gICAgcmV0dXJuIE9iamVjdENoYW5uZWw7XG59KCkpO1xuZXhwb3J0cy5PYmplY3RDaGFubmVsID0gT2JqZWN0Q2hhbm5lbDtcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE3IERXQU5HTyBDby4sIEx0ZC5cblwidXNlIHN0cmljdFwiO1xudmFyIE9iamVjdFNwYWNlID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBPYmplY3RTcGFjZSgpIHtcbiAgICAgICAgdGhpcy5fY2xhc3NlcyA9IHt9O1xuICAgICAgICB0aGlzLl9vYmplY3RzID0ge307XG4gICAgICAgIHRoaXMuX29iamVjdElkcyA9IHt9O1xuICAgIH1cbiAgICBPYmplY3RTcGFjZS5wcm90b3R5cGUuYmluZENsYXNzID0gZnVuY3Rpb24gKGNsYXNzTmFtZSwgaGFuZGxlcikge1xuICAgICAgICB0aGlzLl9jbGFzc2VzW2NsYXNzTmFtZV0gPSBoYW5kbGVyO1xuICAgIH07XG4gICAgT2JqZWN0U3BhY2UucHJvdG90eXBlLnVuYmluZENsYXNzID0gZnVuY3Rpb24gKGNsYXNzTmFtZSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fY2xhc3Nlc1tjbGFzc05hbWVdO1xuICAgIH07XG4gICAgT2JqZWN0U3BhY2UucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uIChjbGFzc05hbWUsIGFyZ3MpIHtcbiAgICAgICAgdmFyIG9iamVjdFRhZyA9IHRoaXMuX2FjcXVpcmVSZW1vdGVPYmplY3RUYWcoY2xhc3NOYW1lKTtcbiAgICAgICAgaWYgKCF0aGlzLl9jbGFzc2VzW2NsYXNzTmFtZV0pIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJjbGFzcyBub3QgYmluZDogXCIgKyBjbGFzc05hbWUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX29iamVjdHNbb2JqZWN0VGFnXSA9IHRoaXMuX2NyZWF0ZUluc3RhbmNlKHRoaXMuX2NsYXNzZXNbY2xhc3NOYW1lXSwgYXJncyk7XG4gICAgICAgIHJldHVybiBvYmplY3RUYWc7XG4gICAgfTtcbiAgICBPYmplY3RTcGFjZS5wcm90b3R5cGUuZ2V0T2JqZWN0ID0gZnVuY3Rpb24gKG9iamVjdFRhZykge1xuICAgICAgICByZXR1cm4gdGhpcy5fb2JqZWN0c1tvYmplY3RUYWddO1xuICAgIH07XG4gICAgT2JqZWN0U3BhY2UucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAob2JqZWN0VGFnKSB7XG4gICAgICAgIHZhciBvYmplY3QgPSB0aGlzLl9vYmplY3RzW29iamVjdFRhZ107XG4gICAgICAgIGlmICghb2JqZWN0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwib2JqZWN0IHVuZGVmaW5lZDogcmVtb3RlLW9iamVjdD1cIiArIG9iamVjdFRhZyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9iamVjdC5kZXN0cm95KSB7XG4gICAgICAgICAgICBvYmplY3QuZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG9iamVjdC5kZXN0cnVjdG9yKSB7XG4gICAgICAgICAgICBvYmplY3QuZGVzdHJ1Y3RvcigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX29iamVjdHNbb2JqZWN0VGFnXSA9IHVuZGVmaW5lZDtcbiAgICB9O1xuICAgIE9iamVjdFNwYWNlLnByb3RvdHlwZS5fY3JlYXRlSW5zdGFuY2UgPSBmdW5jdGlvbiAoY3RvciwgYXJncykge1xuICAgICAgICByZXR1cm4gbmV3IChGdW5jdGlvbi5iaW5kLmFwcGx5KGN0b3IsIFtudWxsXS5jb25jYXQoYXJnc1swXSkpKTtcbiAgICB9O1xuICAgIE9iamVjdFNwYWNlLnByb3RvdHlwZS5fYWNxdWlyZVJlbW90ZU9iamVjdFRhZyA9IGZ1bmN0aW9uIChjbGFzc05hbWUsIG9iamVjdElkKSB7XG4gICAgICAgIGlmICghdGhpcy5fb2JqZWN0SWRzW2NsYXNzTmFtZV0pIHtcbiAgICAgICAgICAgIHRoaXMuX29iamVjdElkc1tjbGFzc05hbWVdID0gMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW9iamVjdElkKSB7XG4gICAgICAgICAgICBvYmplY3RJZCA9IHRoaXMuX29iamVjdElkc1tjbGFzc05hbWVdICsgMTtcbiAgICAgICAgICAgIGlmICghb2JqZWN0SWQpIHtcbiAgICAgICAgICAgICAgICBvYmplY3RJZCA9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9iamVjdElkIDw9IHRoaXMuX29iamVjdElkc1tjbGFzc05hbWVdKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiaW52YWxpZCBvYmplY3RJZCB3YXMgc3BlY2lmaWVkOiBcIiArIG9iamVjdElkKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX29iamVjdElkc1tjbGFzc05hbWVdID0gb2JqZWN0SWQ7XG4gICAgICAgIHJldHVybiBjbGFzc05hbWUgKyBcIjpcIiArIG9iamVjdElkO1xuICAgIH07XG4gICAgcmV0dXJuIE9iamVjdFNwYWNlO1xufSgpKTtcbmV4cG9ydHMuT2JqZWN0U3BhY2UgPSBPYmplY3RTcGFjZTtcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE3IERXQU5HTyBDby4sIEx0ZC5cblwidXNlIHN0cmljdFwiO1xudmFyIE9iamVjdFNwYWNlRkMgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIE9iamVjdFNwYWNlRkMoZnVuY3Rpb25DaGFubmVsLCBvYmplY3RTcGFjZSkge1xuICAgICAgICB0aGlzLl9mdW5jdGlvbkNoYW5uZWwgPSBmdW5jdGlvbkNoYW5uZWw7XG4gICAgICAgIHRoaXMuX29iamVjdFNwYWNlID0gb2JqZWN0U3BhY2U7XG4gICAgfVxuICAgIE9iamVjdFNwYWNlRkMucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uIChjbGFzc05hbWUpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgX2kgPSAxOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgICAgIGFyZ3NbX2kgLSAxXSA9IGFyZ3VtZW50c1tfaV07XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG9iamVjdFRhZyA9IHRoaXMuX29iamVjdFNwYWNlLmNyZWF0ZShjbGFzc05hbWUsIGFyZ3MpO1xuICAgICAgICBpZiAoIW9iamVjdFRhZylcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIHZhciBsb2NhbE9iamVjdCA9IHRoaXMuX29iamVjdFNwYWNlLmdldE9iamVjdChvYmplY3RUYWcpO1xuICAgICAgICB0aGlzLl9mdW5jdGlvbkNoYW5uZWwuYmluZChvYmplY3RUYWcsIGxvY2FsT2JqZWN0KTtcbiAgICAgICAgcmV0dXJuIG9iamVjdFRhZztcbiAgICB9O1xuICAgIE9iamVjdFNwYWNlRkMucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICAgIHRoaXMuX29iamVjdFNwYWNlLmRlc3Ryb3kob2JqZWN0KTtcbiAgICB9O1xuICAgIHJldHVybiBPYmplY3RTcGFjZUZDO1xufSgpKTtcbmV4cG9ydHMuT2JqZWN0U3BhY2VGQyA9IE9iamVjdFNwYWNlRkM7XG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNyBEV0FOR08gQ28uLCBMdGQuXG5cInVzZSBzdHJpY3RcIjtcbi8qKlxuICogZXJyb3ItdHlwZSBvZiBvYmplY3QgY2hhbm5lbFxuICovXG52YXIgRVJST1JfVFlQRV9DTE9TRSA9ICdDbG9zZSc7XG52YXIgUmVtb3RlT2JqZWN0ID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBSZW1vdGVPYmplY3QoY2hhbm5lbCwgc3BhY2UsIHRhZykge1xuICAgICAgICB0aGlzLl9jaGFubmVsID0gY2hhbm5lbDtcbiAgICAgICAgdGhpcy5fc3BhY2UgPSBzcGFjZTtcbiAgICAgICAgdGhpcy5fdGFnID0gdGFnO1xuICAgICAgICB0aGlzLl9kZXN0cm95ZWQgPSBmYWxzZTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTmF0aXZl5YG044Gu44Oh44K944OD44OJ44KS5a6f6KGMXG4gICAgICpcbiAgICAgKiBAcGFyYW0gbWV0aG9kIOWun+ihjOOBmeOCi+ODoeOCveODg+ODieWQjVxuICAgICAqIEBwYXJhbSBbYXJnc10g5a6f6KGM44GZ44KL44Oh44K944OD44OJ44Gr5rih44GZ5byV5pWwXG4gICAgICogQHBhcmFtIFtjYWxsYmFja10g57WQ5p6c44KS5Y+X44GR5Y+W44KL44Kz44O844Or44OQ44OD44KvXG4gICAgICogQHBhcmFtIFt0aW1lb3V0XSDlv5znrZTlvoXjgaHjga7jgr/jgqTjg6DjgqLjgqbjg4hcbiAgICAgKiBAcmV0dXJuIOODoeOCveODg+ODieOBruaIu+OCiuWApFxuICAgICAqL1xuICAgIFJlbW90ZU9iamVjdC5wcm90b3R5cGUuaW52b2tlID0gZnVuY3Rpb24gKG1ldGhvZCwgYXJncywgY2FsbGJhY2ssIHRpbWVvdXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Rlc3Ryb3llZCkge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIFtcIkFscmVhZHlEZXN0cm95ZWRcIl0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2NoYW5uZWwuaW52b2tlKHRoaXMuX3RhZywgbWV0aG9kLCBhcmdzLCBjYWxsYmFjaywgdGltZW91dCk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBOYXRpdmXlgbTjga7jgqrjg5bjgrjjgqfjgq/jg4jjgpLnoLTmo4RcbiAgICAgKi9cbiAgICBSZW1vdGVPYmplY3QucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLl9kZXN0cm95ZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jaGFubmVsLmludm9rZShcIiRvYmpcIiwgXCJkZXN0cm95XCIsIFt0aGlzLl90YWddKTtcbiAgICAgICAgdGhpcy5fZGVzdHJveWVkID0gdHJ1ZTtcbiAgICB9O1xuICAgIHJldHVybiBSZW1vdGVPYmplY3Q7XG59KCkpO1xuZXhwb3J0cy5SZW1vdGVPYmplY3QgPSBSZW1vdGVPYmplY3Q7XG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNyBEV0FOR08gQ28uLCBMdGQuXG5cInVzZSBzdHJpY3RcIjtcbnZhciBPYmplY3RDaGFubmVsXzEgPSByZXF1aXJlKCcuL09iamVjdENoYW5uZWwnKTtcbmV4cG9ydHMuT2JqZWN0Q2hhbm5lbCA9IE9iamVjdENoYW5uZWxfMS5PYmplY3RDaGFubmVsO1xudmFyIE9iamVjdFNwYWNlXzEgPSByZXF1aXJlKCcuL09iamVjdFNwYWNlJyk7XG5leHBvcnRzLk9iamVjdFNwYWNlID0gT2JqZWN0U3BhY2VfMS5PYmplY3RTcGFjZTtcbnZhciBSZW1vdGVPYmplY3RfMSA9IHJlcXVpcmUoJy4vUmVtb3RlT2JqZWN0Jyk7XG5leHBvcnRzLlJlbW90ZU9iamVjdCA9IFJlbW90ZU9iamVjdF8xLlJlbW90ZU9iamVjdDtcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE3IERXQU5HTyBDby4sIEx0ZC5cblwidXNlIHN0cmljdFwiO1xudmFyIE9iamVjdENoYW5uZWxXcmFwcGVyXzEgPSByZXF1aXJlKCcuL09iamVjdENoYW5uZWxXcmFwcGVyJyk7XG5leHBvcnRzLk9iamVjdENoYW5uZWxXcmFwcGVyID0gT2JqZWN0Q2hhbm5lbFdyYXBwZXJfMS5PYmplY3RDaGFubmVsV3JhcHBlcjtcbiJdfQ==
