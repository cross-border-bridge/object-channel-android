// Copyright © 2017 DWANGO Co., Ltd.
package jp.co.dwango.cbb.oc;

import android.support.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.util.ArrayList;
import java.util.List;

import jp.co.dwango.cbb.db.MemoryQueue;
import jp.co.dwango.cbb.db.MemoryQueueDataBus;
import jp.co.dwango.cbb.dc.DataChannel;
import jp.co.dwango.cbb.fc.FunctionChannel;

public class ObjectChannelTest {
	private MemoryQueueDataBus dataBus1;
	private MemoryQueueDataBus dataBus2;
	private DataChannel dataChannel1;
	private DataChannel dataChannel2;
	private FunctionChannel functionChannel1;
	private FunctionChannel functionChannel2;
	private ObjectChannel objectChannel1;
	private ObjectChannel objectChannel2;
	private RemoteObject remoteObject;
	private List<RemoteObject> remoteObjects = new ArrayList<RemoteObject>();

	@Before
	public void setUp() {
		ObjectChannel.logging(false);
	}

	private void before() {
		MemoryQueue memoryQueue1 = new MemoryQueue();
		MemoryQueue memoryQueue2 = new MemoryQueue();
		dataBus1 = new MemoryQueueDataBus(memoryQueue1, memoryQueue2);
		dataBus2 = new MemoryQueueDataBus(memoryQueue2, memoryQueue1);
		dataChannel1 = new DataChannel(dataBus1);
		dataChannel2 = new DataChannel(dataBus2);
		functionChannel1 = new FunctionChannel(dataChannel1);
		functionChannel2 = new FunctionChannel(dataChannel2);
		objectChannel1 = new ObjectChannel(functionChannel1);
		objectChannel2 = new ObjectChannel(functionChannel2);
		objectChannel2.bind(MyClassJava.class);
	}

	private void after() {
		objectChannel2.unbind("MyClassJava");
		objectChannel1.destroy();
		objectChannel2.destroy();
		functionChannel1.destroy();
		functionChannel2.destroy();
		dataChannel1.destroy();
		dataChannel2.destroy();
		dataBus1.destroy();
		dataBus2.destroy();
	}

	@Test
	public void test_正常系_一般的なシーケンス_コンストラクタ引数なし() {
		before();
		// リモートオブジェクトを生成
		objectChannel1.create("MyClassJava", null, new RemoteObjectHandler() {
			@Override
			public void onResult(@Nullable RemoteObject object) {
				Assert.assertNotNull(object);
				remoteObject = object;
			}
		});
		// リモート側で生成したインスタンスを取得 (※これはテスト専用の機能です)
		MyClassJava object = (MyClassJava) objectChannel2.rpc.getObject(remoteObject.toString());
		Assert.assertNull(object.argument);
		// 適当なメソッドを実行
		remoteObject.invoke("countUp", null);
		remoteObject.invoke("getCount", null, new RemoteObjectResultHandler() {
			@Override
			public void onResult(@Nullable Object result) {
				Assert.assertEquals(1, result);
			}
		});
		// 破棄でデストラクタが実行されることを確認
		Assert.assertFalse(remoteObject.destroyed);
		Assert.assertFalse(object.destroyed);
		remoteObject.destroy();
		Assert.assertTrue(remoteObject.destroyed);
		Assert.assertTrue(object.destroyed);
		after();
	}

	@Test
	public void test_正常系_デストラクタの暗示実行() {
		before();
		// リモートオブジェクトを生成
		objectChannel1.create("MyClassJava", null, new RemoteObjectHandler() {
			@Override
			public void onResult(@Nullable RemoteObject object) {
				Assert.assertNotNull(object);
				remoteObject = object;
			}
		});
		// リモート側で生成したインスタンスを取得 (※これはテスト専用の機能です)
		MyClassJava object = (MyClassJava) objectChannel2.rpc.getObject(remoteObject.toString());
		Assert.assertNull(object.argument);
		// object-channelを破棄することでデストラクタが暗示実行されることを確認
		after();
		Assert.assertTrue(remoteObject.destroyed);
		Assert.assertTrue(object.destroyed);
	}

	@Test
	public void test_正常系_一般的なシーケンス_コンストラクタ引数あり() {
		before();
		// リモートオブジェクトを生成
		objectChannel1.create("MyClassJava", new JSONArray().put("This is test."), new RemoteObjectHandler() {
			@Override
			public void onResult(@Nullable RemoteObject object) {
				Assert.assertNotNull(object);
				remoteObject = object;
			}
		});
		// リモート側で生成したインスタンスを取得 (※これはテスト専用の機能です)
		MyClassJava object = (MyClassJava) objectChannel2.rpc.getObject(remoteObject.toString());
		Assert.assertEquals("This is test.", object.argument);
		// 適当なメソッドを実行
		remoteObject.invoke("countUp", null);
		remoteObject.invoke("getCount", null, new RemoteObjectResultHandler() {
			@Override
			public void onResult(@Nullable Object result) {
				Assert.assertEquals(1, result);
			}
		});
		// 破棄でデストラクタが実行されることを確認
		Assert.assertFalse(remoteObject.destroyed);
		Assert.assertFalse(object.destroyed);
		remoteObject.destroy();
		Assert.assertTrue(remoteObject.destroyed);
		Assert.assertTrue(object.destroyed);
		after();
	}

	@Test
	public void test_異常系_存在しないコンストラクタ引数を指定() {
		before();
		// リモートオブジェクトを生成
		objectChannel1.create("MyClassJava", new JSONArray().put("This is test.").put(2525), new RemoteObjectHandler() {
			@Override
			public void onResult(@Nullable RemoteObject object) {
				Assert.assertNull(object);
			}
		});
		after();
	}

	@Test
	public void test_異常系_bindしていないクラスを指定() {
		before();
		// リモートオブジェクトを生成
		objectChannel1.create("MyClassJavaX", null, new RemoteObjectHandler() {
			@Override
			public void onResult(@Nullable RemoteObject object) {
				Assert.assertNull(object);
			}
		});
		after();
	}

	@Test
	public void test_正常系_JSONからRemoteObjectTagを生成() {
		// ※このテストは通常のユースケースでの利用を想定したものではありません
		JSONObject tagJson = new JSONObject();
		try {
			tagJson.put("className", "MyClass");
			tagJson.put("objectId", 2525);
			RemoteObjectTag tag = RemoteObjectTag.fromJSON(tagJson);
			Assert.assertNotNull(tag);
			Assert.assertEquals("MyClass:2525", tag.toString());
			Assert.assertEquals("{\"className\":\"MyClass\",\"objectId\":2525}", tag.toJSON().toString());
		} catch (JSONException e) {
			e.printStackTrace();
			Assert.fail();
		}
	}

	@Test
	public void test_異常系_JSONからRemoteObjectTagを生成() {
		// ※このテストは通常のユースケースでの利用を想定したものではありません
		JSONObject tagJson = new JSONObject();
		try {
			tagJson.put("className", "MyClass");
			RemoteObjectTag tag = RemoteObjectTag.fromJSON(tagJson);
			Assert.assertNull(tag);
		} catch (JSONException e) {
			e.printStackTrace();
			Assert.fail();
		}
	}

	@Test
	public void test_異常系_故意に実行先のfunctionChannelを閉じる_コンストラクタ() {
		before();
		// 意図的に接続先のfunction-channelを破棄
		objectChannel2.functionChannel.destroy();
		// リモートオブジェクトを生成
		objectChannel1.create("MyClassJava", null, new RemoteObjectHandler() {
			@Override
			public void onResult(@Nullable RemoteObject object) {
				Assert.assertNull(object);
			}
		});
		after();
	}

	@Test
	public void test_異常系_故意に実行先のfunctionChannelを閉じる_RemoteObject() {
		before();
		// リモートオブジェクトを生成
		objectChannel1.create("MyClassJava", null, new RemoteObjectHandler() {
			@Override
			public void onResult(@Nullable RemoteObject object) {
				Assert.assertNotNull(object);
				remoteObject = object;
			}
		});
		// 意図的に接続先のfunction-channelのオブジェクトをunbind
		objectChannel2.functionChannel.unbind(remoteObject.toString());

		// 破棄後にメソッド実行
		remoteObject.invoke("countUp", null);
		remoteObject.invoke("getCount", null, new RemoteObjectResultHandler() {
			@Override
			public void onResult(@Nullable Object result) {
				Assert.assertNull(result);
			}
		});

		after();
	}

	@Test
	public void test_異常系_ObjectChannelInterfaceをimplementsしていないクラスをbind() {
		before();
		Assert.assertFalse(objectChannel1.bind(InvalidClass.class));
		after();
	}

	@Test
	public void test_異常系_destroy済みのオブジェクトに対して色々と操作() {
		before();
		// リモートオブジェクトを生成
		objectChannel1.create("MyClassJava", null, new RemoteObjectHandler() {
			@Override
			public void onResult(@Nullable RemoteObject object) {
				Assert.assertNotNull(object);
				remoteObject = object;
			}
		});
		// 破棄
		remoteObject.destroy();
		Assert.assertTrue(remoteObject.destroyed);
		// 破棄済みのオブジェクトを色々と操作
		remoteObject.destroy();
		remoteObject.invoke("foo", null, new RemoteObjectResultHandler() {
			@Override
			public void onResult(@Nullable Object result) {
				Assert.assertNull(result);
			}
		});
		remoteObject.invoke("foo", null);
		after();
	}

	@Test
	public void test_正常系_複数のRemoteObjectを生成() {
		before();
		remoteObjects.clear();
		for (int i = 0; i < 1024; i++) {
			objectChannel1.create("MyClassJava", null, new RemoteObjectHandler() {
				@Override
				public void onResult(@Nullable RemoteObject object) {
					remoteObjects.add(object);
				}
			});
		}
		Assert.assertEquals(1024, remoteObjects.size());
		for (RemoteObject o : remoteObjects) {
			Assert.assertFalse(o.destroyed);
			o.destroy();
			Assert.assertTrue(o.destroyed);
		}
		after();
	}

	@Test
	public void test_正常系_色々な引数パターンのコンストラクタ呼び出し() {
		before();

		// 0個
		objectChannel1.create("MyClassJava", null, new RemoteObjectHandler() {
			@Override
			public void onResult(@Nullable RemoteObject object) {
				remoteObject = object;
			}
		});
		remoteObject.invoke("getArgument", null, new RemoteObjectResultHandler() {
			@Override
			public void onResult(@Nullable Object result) {
				Assert.assertEquals(JSONObject.NULL, result);
			}
		});
		remoteObject.invoke("getArguments", null, new RemoteObjectResultHandler() {
			@Override
			public void onResult(@Nullable Object result) {
				Assert.assertEquals(JSONObject.NULL, result);
			}
		});
		remoteObject.destroy();

		// 1個
		objectChannel1.create("MyClassJava", new JSONArray().put("Hello"), new RemoteObjectHandler() {
			@Override
			public void onResult(@Nullable RemoteObject object) {
				remoteObject = object;
			}
		});
		remoteObject.invoke("getArgument", null, new RemoteObjectResultHandler() {
			@Override
			public void onResult(@Nullable Object result) {
				Assert.assertEquals("Hello", result);
			}
		});
		remoteObject.invoke("getArguments", null, new RemoteObjectResultHandler() {
			@Override
			public void onResult(@Nullable Object result) {
				Assert.assertEquals(JSONObject.NULL, result);
			}
		});
		remoteObject.destroy();

		// 3個
		objectChannel1.create("MyClassJava", new JSONArray().put("one").put("two").put("three"), new RemoteObjectHandler() {
			@Override
			public void onResult(@Nullable RemoteObject object) {
				remoteObject = object;
			}
		});
		remoteObject.invoke("getArgument", null, new RemoteObjectResultHandler() {
			@Override
			public void onResult(@Nullable Object result) {
				Assert.assertEquals(JSONObject.NULL, result);
			}
		});
		remoteObject.invoke("getArguments", null, new RemoteObjectResultHandler() {
			@Override
			public void onResult(@Nullable Object result) {
				JSONArray array = (JSONArray) result;
				Assert.assertNotNull(array);
				Assert.assertEquals(3, array.length());
				try {
					Assert.assertEquals("one", array.get(0));
					Assert.assertEquals("two", array.get(1));
					Assert.assertEquals("three", array.get(2));
				} catch (JSONException e) {
					e.printStackTrace();
					Assert.fail();
				}
			}
		});
		remoteObject.destroy();

		after();
	}
}