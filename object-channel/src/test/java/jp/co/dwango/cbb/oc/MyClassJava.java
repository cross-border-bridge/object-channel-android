// Copyright © 2017 DWANGO Co., Ltd.
package jp.co.dwango.cbb.oc;

import jp.co.dwango.cbb.fc.AsyncCallback;
import jp.co.dwango.cbb.fc.AsyncResult;
import jp.co.dwango.cbb.fc.CrossBorderMethod;

public class MyClassJava implements CrossBorderInterface {
	boolean destroyed = false;
	String argument;
	String[] arguments;
	private int count = 0;

	public MyClassJava() {
		this(null);
	}

	public MyClassJava(String argument) {
		this.argument = argument;
	}

	public MyClassJava(String arg1, String arg2, String arg3) {
		arguments = new String[3];
		arguments[0] = arg1;
		arguments[1] = arg2;
		arguments[2] = arg3;
	}

	@CrossBorderMethod
	public String getArgument() {
		return argument;
	}

	@CrossBorderMethod
	public String[] getArguments() {
		return arguments;
	}

	void reset() {
		count = 0;
	}

	@CrossBorderMethod
	public void countUp() {
		count++;
	}

	@CrossBorderMethod
	public void countDown() {
		count--;
	}

	@CrossBorderMethod
	public int getCount() {
		return count;
	}

	@CrossBorderMethod
	public int add(int a, int b) {
		return a + b;
	}

	@CrossBorderMethod
	public AsyncResult<Integer> countUpAsync() {
		return new AsyncResult<Integer>() {
			@Override
			public void run(AsyncCallback<Integer> callback) {
				try {
					Thread.sleep(300);
				} catch (InterruptedException e) {
					e.printStackTrace();
				}
				count++;
				callback.onResult(count);
			}
		};
	}

	@Override
	public void destroy() {
		destroyed = true;
	}
}
