// Copyright © 2017 DWANGO Co., Ltd.
package jp.co.dwango.cbb.oc;

import android.support.annotation.Nullable;

import org.json.JSONArray;

import jp.co.dwango.cbb.fc.FunctionChannelCallback;

public class RemoteObject {
	private final ObjectChannel channel;
	private final RemoteObjectTag tag;
	boolean destroyed = false;

	RemoteObject(ObjectChannel channel, RemoteObjectTag tag) {
		this.channel = channel;
		this.tag = tag;
	}

	public void invoke(String method, JSONArray args) {
		invoke(method, args, null);
	}

	public void invoke(String method, JSONArray args, @Nullable final RemoteObjectResultHandler handler) {
		if (destroyed) {
			Logger.e("remote object was already destroyed");
			return;
		}
		channel.functionChannel.invoke(tag.toString(), method, args, handler == null ? null : new FunctionChannelCallback() {
			@Override
			public void onResult(boolean isError, Object result) {
				if (isError) {
					handler.onResult(null);
					return;
				}
				handler.onResult(result);
			}
		});
	}

	public void destroy() {
		if (destroyed) {
			Logger.e("remote object was already destroyed");
			return;
		}
		destroyed = true;
		channel.functionChannel.invoke("$obj", "destroy", new JSONArray().put(tag), new FunctionChannelCallback() {
			@Override
			public void onResult(boolean isError, Object result) {
				Logger.d("deleted object: " + tag.toString() + " (isError: " + isError + ", result: " + result + ")");
			}
		});
		channel.destroy(this);
	}

	public String toString() {
		return tag.toString();
	}
}
