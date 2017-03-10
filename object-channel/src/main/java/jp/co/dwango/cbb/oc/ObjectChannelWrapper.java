// Copyright © 2017 DWANGO Co., Ltd.
package jp.co.dwango.cbb.oc;

import android.support.annotation.Nullable;

import org.json.JSONArray;

import jp.co.dwango.cbb.db.DataBus;
import jp.co.dwango.cbb.dc.DataChannel;
import jp.co.dwango.cbb.fc.FunctionChannel;

public class ObjectChannelWrapper {
	private final DataChannel dataChannel;
	private final FunctionChannel functionChannel;
	private final ObjectChannel objectChannel;

	public ObjectChannelWrapper(DataBus dataBus) {
		dataChannel = new DataChannel(dataBus);
		functionChannel = new FunctionChannel(dataChannel);
		objectChannel = new ObjectChannel(functionChannel);
	}

	public boolean bind(Class clazz) {
		return objectChannel.bind(clazz);
	}

	@Nullable
	public Class getClass(String className) {
		return objectChannel.getClass(className);
	}

	public void unbind(String className) {
		objectChannel.unbind(className);
	}

	public void create(String className, JSONArray args, RemoteObjectHandler handler) {
		objectChannel.create(className, args, handler);
	}

	public void destroy() {
		objectChannel.destroy();
		functionChannel.destroy();
		dataChannel.destroy();
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
