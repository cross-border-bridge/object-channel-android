// Copyright © 2017 DWANGO Co., Ltd.
package jp.co.dwango.cbb.oc.test;

import android.util.Log;

import jp.co.dwango.cbb.fc.AsyncCallback;
import jp.co.dwango.cbb.fc.AsyncResult;
import jp.co.dwango.cbb.fc.CrossBorderMethod;
import jp.co.dwango.cbb.oc.CrossBorderInterface;

class MyClassJava implements CrossBorderInterface {
	private final String c;

	// constructorはアノテーションを付けなくてもよい（そもそも付けられない）
	public MyClassJava(String c) {
		Log.d("MyClassJava", "executing constructor(" + c + ")");
		this.c = "t" + System.currentTimeMillis();
	}

	// 同期RPC
	@CrossBorderMethod
	public String foo(String a1, String a2, String a3) {
		Log.d("MyClassJava", "executing MyClassJava.foo(" + a1 + "," + a2 + "," + a3 + ")");
		return a1 + "," + a2 + "," + a3 + ":" + c;
	}

	// 非同期RPC
	@CrossBorderMethod
	public AsyncResult<String> fooA(final String a1, final String a2, final String a3) {
		Log.d("MyClassJava", "executing MyClassJava.fooA(" + a1 + "," + a2 + "," + a3 + ")");
		return new AsyncResult<String>() {
			@Override
			public void run(final AsyncCallback<String> callback) {
				// 3秒後に応答を返す
				try {
					Thread.sleep(3000);
				} catch (InterruptedException e) {
					e.printStackTrace();
				}
				callback.onResult(a1 + "," + a2 + "," + a3 + ":" + c);
			}
		};
	}

	// デストラクタ
	@Override
	public void destroy() {
		Log.d("MyClassJava", "executing destructor");
	}
}
