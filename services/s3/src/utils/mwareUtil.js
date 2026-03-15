function callClient(client, methodName, req, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    let called = false;
    const timer = setTimeout(() => {
      if (!called) {
        called = true;
        reject(new Error(`${methodName} RPC timeout`));
      }
    }, timeoutMs);

    try {
      client[methodName](req, (err, res) => {
        if (called) return;
        called = true;
        clearTimeout(timer);
        if (err) return reject(err);
        resolve(res);
      });
    } catch (e) {
      if (!called) {
        called = true;
        clearTimeout(timer);
        reject(e);
      }
    }
  });
}

function fuse(...steps) {
  return async function (ctx) {
    let result = ctx;
    for (const step of steps) {
      result = await step(result);
    }
    return result;
  };
}

module.exports = {
    callClient,
    fuse
}