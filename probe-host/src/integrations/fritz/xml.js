const { SaxesParser } = require('saxes');

function invalidResponse() {
  return Object.assign(new Error('Invalid FRITZ! response.'), { code: 'INVALID_RESPONSE' });
}

function parseXml(input) {
  const parser = new SaxesParser({ xmlns: true });
  const stack = [];
  let root;
  parser.on('doctype', () => { throw invalidResponse(); });
  parser.on('error', () => { throw invalidResponse(); });
  parser.on('opentag', ({ local, uri }) => {
    if (stack.length >= 32) throw invalidResponse();
    const node = { name: local, namespace: uri, text: '', children: [] };
    if (stack.length) stack.at(-1).children.push(node);
    else root = node;
    stack.push(node);
  });
  const append = (value) => {
    if (stack.length) stack.at(-1).text += value;
  };
  parser.on('text', append);
  parser.on('cdata', append);
  parser.on('closetag', () => stack.pop());
  parser.write(input).close();
  if (!root) throw invalidResponse();
  return root;
}

function child(node, name) {
  return node?.children.find((entry) => entry.name === name);
}

function field(node, name) {
  return child(node, name)?.text.trim() ?? '';
}

module.exports = { child, field, invalidResponse, parseXml };
