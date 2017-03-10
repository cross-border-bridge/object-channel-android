// Copyright © 2017 DWANGO Co., Ltd.
package jp.co.dwango.cbb.oc;

import android.support.annotation.Nullable;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jp.co.dwango.cbb.fc.FunctionChannel;
import jp.co.dwango.cbb.fc.FunctionChannelCallback;

public class ObjectChannel {
	final FunctionChannel functionChannel;
	final ObjectChannelRPC rpc;
	private final ObjectChannel _this;
	private final Map<String, Class> classes = new HashMap<String, Class>();
	private final List<RemoteObject> remoteObjects = new ArrayList<RemoteObject>();
	private boolean destroyed = false;

	/**
	 * object-channel を生成
	 *
	 * @param functionChannel function-channel
	 */
	public ObjectChannel(FunctionChannel functionChannel) {
		_this = this;
		this.functionChannel = functionChannel;
		rpc = new ObjectChannelRPC(this);
		this.functionChannel.bind("$obj", rpc);
	}

	/**
	 * ログ出力の有効化/無効化
	 *
	 * @param enabled true = 有効, false = 無効
	 */
	public static void logging(boolean enabled) {
		Logger.enabled = enabled;
	}

	/**
	 * リモートからインスタンス化できるクラスを bind
	 *
	 * @param clazz リモートからインスタンス化できるクラス
	 */
	public boolean bind(Class clazz) {
		if (destroyed) return false;
		boolean found = false;
		for (Class i : clazz.getInterfaces()) {
			if (i == CrossBorderInterface.class) {
				found = true;
				break;
			}
		}
		if (!found) {
			Logger.e(getClassName(clazz) + " has not implement the CrossBorderInterface.");
			return false;
		}
		String className = getClassName(clazz);
		Logger.d("bind: " + className);
		unbind(className);
		classes.put(className, clazz);
		return true;
	}

	/**
	 * bindしているクラスを取得
	 *
	 * @param className 取得するクラス名
	 * @return bindしているクラス（存在しない場合は null）
	 */
	@Nullable
	public Class getClass(String className) {
		if (destroyed) return null;
		return classes.get(className);
	}

	/**
	 * クラスの bind を解除
	 *
	 * @param className bind を解除するクラス名
	 */
	public void unbind(String className) {
		if (destroyed) return;
		if (classes.containsKey(className)) {
			Logger.d("unbind: " + className);
			classes.remove(className);
		}
	}

	// クラスからクラス名を取得（パッケージ名を削除）
	String getClassName(Class clazz) {
		String result = clazz.getName();
		int index = result.length() - 1;
		for (; 0 <= index; index--) {
			if ('.' == result.charAt(index)) {
				index++;
				break;
			}
		}
		return index < 0 ? result : result.substring(index);
	}

	/**
	 * リモート側でbindされているクラスのインスタンス化
	 *
	 * @param className クラス名
	 * @param args      コンストラクタに渡す引数
	 * @param handler   インスタンスを受け取るハンドラ
	 */
	public void create(String className, JSONArray args, final RemoteObjectHandler handler) {
		if (destroyed) return;
		functionChannel.invoke("$obj", "create", new JSONArray().put(className).put(null != args ? args : new JSONArray()), new FunctionChannelCallback() {
			@Override
			public void onResult(boolean isError, Object result) {
				if (isError) {
					Logger.e("function channel error");
					handler.onResult(null);
					return;
				}
				if (!(result instanceof String)) {
					Logger.e("constructor failed");
					handler.onResult(null);
					return;
				}
				final RemoteObjectTag tag = RemoteObjectTag.fromString((String) result);
				final RemoteObject object = new RemoteObject(_this, tag);
				remoteObjects.add(object);
				handler.onResult(object);
			}
		});
	}

	void destroy(RemoteObject object) {
		if (destroyed) return;
		remoteObjects.remove(object);
	}

	/**
	 * object-channel を破棄
	 */
	public void destroy() {
		destroyed = true;
		while (!remoteObjects.isEmpty()) {
			remoteObjects.remove(0).destroy();
		}
		classes.clear();
		functionChannel.destroy();
	}

	@Override
	protected void finalize() throws Throwable {
		try {
			super.finalize();
		} finally {
			destroy();
		}
	}
}
