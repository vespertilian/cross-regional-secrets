exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'hello-world',
      foo: 'bar',
      baz: 'bob',
    }),
  };
};
