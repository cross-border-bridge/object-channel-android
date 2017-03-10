// Copyright © 2017 DWANGO Co., Ltd.
package jp.co.dwango.cbb.oc.test;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.os.Build;
import android.os.Bundle;
import android.support.annotation.Nullable;
import android.support.v7.app.AppCompatActivity;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONArray;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

import jp.co.dwango.cbb.db.DataBus;
import jp.co.dwango.cbb.db.WebViewDataBus;
import jp.co.dwango.cbb.dc.DataChannel;
import jp.co.dwango.cbb.fc.FunctionChannel;
import jp.co.dwango.cbb.oc.ObjectChannel;
import jp.co.dwango.cbb.oc.ObjectChannelWrapper;
import jp.co.dwango.cbb.oc.RemoteObject;
import jp.co.dwango.cbb.oc.RemoteObjectHandler;
import jp.co.dwango.cbb.oc.RemoteObjectResultHandler;

public class MainActivity extends AppCompatActivity {
	private RemoteObject object;

	@TargetApi(Build.VERSION_CODES.KITKAT)
	@SuppressLint("SetJavaScriptEnabled")
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		final MainActivity _this = this;
		// KITKAT以上の場合は Chrome でのデバッグを有効にする
		if (Build.VERSION_CODES.KITKAT <= Build.VERSION.SDK_INT) {
			WebView.setWebContentsDebuggingEnabled(true);
		}
		setContentView(R.layout.activity_main);
		WebView webView = (WebView) findViewById(R.id.web_view);
		assert webView != null;

		// デバッグログ出力を有効化
		DataBus.logging(true);
		DataChannel.logging(true);
		FunctionChannel.logging(true);
		ObjectChannel.logging(true);

		// DataBusを用いるWebViewを指定してインスタンス化
		final DataBus dataBus = new WebViewDataBus(this, webView);

		// ObjectChannelを作成
		final ObjectChannelWrapper objectChannel = new ObjectChannelWrapper(dataBus);

		// リモートから操作できるクラスを登録
		objectChannel.bind(MyClassJava.class);

		// ボタンを準備: オブジェクト生成
		View b1 = findViewById(R.id.send_request_create);
		assert b1 != null;
		b1.setOnClickListener(new View.OnClickListener() {
			@Override
			public void onClick(View view) {
				if (null != object) {
					Toast.makeText(_this, "remote object has already created.", Toast.LENGTH_SHORT).show();
					return;
				}
				JSONArray args = new JSONArray();
				args.put("t" + System.currentTimeMillis());
				args.put("hoge-argument");
				objectChannel.create("MyClassJS", args, new RemoteObjectHandler() {
					@Override
					public void onResult(@Nullable RemoteObject object) {
						Toast.makeText(_this, "created a remote object: " + object, Toast.LENGTH_SHORT).show();
						_this.object = object;
					}
				});
			}
		});

		// ボタンを準備: メソッド呼び出し
		View b2 = findViewById(R.id.send_request_invoke);
		assert b2 != null;
		b2.setOnClickListener(new View.OnClickListener() {
			@Override
			public void onClick(View view) {
				if (null == object) {
					Toast.makeText(_this, "remote object is not exist.", Toast.LENGTH_SHORT).show();
					return;
				}
				JSONArray args = new JSONArray().put("a1").put("a2").put("a3");
				object.invoke("foo", args, new RemoteObjectResultHandler() {
					@Override
					public void onResult(Object result) {
						Toast.makeText(MainActivity.this, "result: " + result, Toast.LENGTH_SHORT).show();
					}
				});
			}
		});

		// ボタンを準備: オブジェクト破棄
		View b3 = findViewById(R.id.send_request_destroy);
		assert b3 != null;
		b3.setOnClickListener(new View.OnClickListener() {
			@Override
			public void onClick(View view) {
				if (null == object) {
					Toast.makeText(_this, "remote object has already destroyed.", Toast.LENGTH_SHORT).show();
					return;
				}
				Toast.makeText(_this, "destroy a remote object: " + object, Toast.LENGTH_SHORT).show();
				object.destroy();
				object = null;
			}
		});

		// ボタンを準備: 破棄
		View b4 = findViewById(R.id.send_request_destroy_all);
		assert b4 != null;
		b4.setOnClickListener(new View.OnClickListener() {
			@Override
			public void onClick(View view) {
				objectChannel.destroy();
				dataBus.destroy();
			}
		});

		// WebView を 準備
		webView.getSettings().setJavaScriptEnabled(true);
		webView.setWebChromeClient(new WebChromeClient() {
			@Override
			public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
				Log.d("CrossBorderBridge-js", consoleMessage.message() + " (src=" + consoleMessage.sourceId() + ", line=" + consoleMessage.lineNumber() + ")");
				return super.onConsoleMessage(consoleMessage);
			}
		});

		// WebView へコンテンツをロード
		webView.loadDataWithBaseURL("", loadHtml("html/index.html"), "text/html", "UTF-8", null);
	}

	private String loadHtml(String path) {
		InputStream is = null;
		BufferedReader br = null;
		StringBuilder result = new StringBuilder(16384);
		try {
			is = getAssets().open(path);
			br = new BufferedReader(new InputStreamReader(is));
			String str;
			while ((str = br.readLine()) != null) {
				result.append(str).append("\n");
			}
		} catch (IOException e) {
			e.printStackTrace();
		} finally {
			if (null != is) try {
				is.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
			if (null != br) try {
				br.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
		return result.toString();
	}
}
