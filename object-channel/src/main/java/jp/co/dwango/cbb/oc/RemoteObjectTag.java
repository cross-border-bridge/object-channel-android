// Copyright © 2017 DWANGO Co., Ltd.
package jp.co.dwango.cbb.oc;

import org.json.JSONException;
import org.json.JSONObject;

public class RemoteObjectTag {
	public String className;
	public int objectId;

	public RemoteObjectTag(String className, int objectId) {
		Logger.d("create RemoteObjectTag: className = " + className + ", objectId = " + objectId);
		this.className = className;
		this.objectId = objectId;
	}

	public static RemoteObjectTag fromJSON(JSONObject json) {
		try {
			return new RemoteObjectTag(json.getString("className"), json.getInt("objectId"));
		} catch (JSONException e) {
			Logger.printStackTrace(e);
		}
		return null;
	}

	public static RemoteObjectTag fromString(String string) {
		int i = string.indexOf(":");
		return new RemoteObjectTag(
				string.substring(0, i),
				Integer.parseInt(string.substring(i + 1))
		);
	}

	public String toString() {
		return className + ":" + objectId;
	}

	public JSONObject toJSON() {
		JSONObject result = new JSONObject();
		try {
			result.put("className", className);
			result.put("objectId", objectId);
			return result;
		} catch (JSONException e) {
			Logger.printStackTrace(e);
		}
		return null;
	}
}
