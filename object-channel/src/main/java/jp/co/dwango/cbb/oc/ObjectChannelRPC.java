// Copyright © 2017 DWANGO Co., Ltd.
package jp.co.dwango.cbb.oc;

import android.support.v4.util.Pair;

import org.json.JSONArray;
import org.json.JSONException;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

import jp.co.dwango.cbb.fc.CrossBorderMethod;

// 注意: JUnit でテストするために public にしている
public class ObjectChannelRPC {
	private final ObjectChannel objectChannel;
	private final Map<String, Integer> latestInstanceId = new HashMap<String, Integer>();
	private final Map<String, Object> objects = new HashMap<String, Object>();

	ObjectChannelRPC(ObjectChannel objectChannel) {
		this.objectChannel = objectChannel;
	}

	@CrossBorderMethod
	public RemoteObjectTag create(String className, JSONArray args) {
		RemoteObjectTag tag = new RemoteObjectTag(className, acquireObjectId(className));
		String tagString = tag.toString();
		Class clazz = objectChannel.getClass(className);
		if (objects.containsKey(tagString)) objects.remove(tagString);
		Pair<Class<?>[], Object[]> arguments = makeArguments(args);
		if (null == arguments) {
			try {
				objects.put(tagString, clazz.newInstance());
			} catch (InstantiationException e) {
				Logger.printStackTrace(e);
				return null;
			} catch (IllegalAccessException e) {
				Logger.printStackTrace(e);
				return null;
			}
		} else {
			try {
				Constructor constructor = clazz.getConstructor(arguments.first);
				objects.put(tagString, constructor.newInstance(arguments.second));
			} catch (NoSuchMethodException e) {
				Logger.printStackTrace(e);
				return null;
			} catch (InstantiationException e) {
				Logger.printStackTrace(e);
				return null;
			} catch (IllegalAccessException e) {
				Logger.printStackTrace(e);
				return null;
			} catch (InvocationTargetException e) {
				Logger.printStackTrace(e);
				return null;
			}
		}
		objectChannel.functionChannel.bind(tagString, objects.get(tagString));
		return tag;
	}

	@CrossBorderMethod
	public void destroy(String tag) {
		objectChannel.functionChannel.unbind(tag);
		Object o = objects.remove(tag);
		try {
			Method destructor = o.getClass().getMethod("destroy");
			if (null != destructor) destructor.invoke(o);
		} catch (NoSuchMethodException e) {
			Logger.d("destructor not defined (ignore)");
		} catch (IllegalAccessException e) {
			Logger.printStackTrace(e);
		} catch (InvocationTargetException e) {
			Logger.printStackTrace(e);
		}
	}

	private Pair<Class<?>[], Object[]> makeArguments(JSONArray json) {
		if (null == json || json.length() < 1) return null;
		Pair<Class<?>[], Object[]> result = new Pair<Class<?>[], Object[]>(new Class<?>[json.length()], new Object[json.length()]);
		for (int i = 0; i < json.length(); i++) {
			try {
				Object o = json.get(i);
				if (null != o) {
					result.first[i] = o.getClass();
					result.second[i] = o;
				} else {
					result.first[i] = null;
					result.second[i] = null;
				}
			} catch (JSONException e) {
				Logger.printStackTrace(e);
				result.first[i] = null;
				result.second[i] = null;
			}
		}
		return result;
	}

	private int acquireObjectId(String className) {
		if (latestInstanceId.containsKey(className)) {
			latestInstanceId.put(className, latestInstanceId.get(className) + 1);
		} else {
			latestInstanceId.put(className, 1);
		}
		return latestInstanceId.get(className);
	}

	Object getObject(String tagString) {
		return objects.get(tagString);
	}
}
