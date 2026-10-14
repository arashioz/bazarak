import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

export function loadSource(relativePath, mocks = {}) {
  const filename = new URL(relativePath, new URL('../', import.meta.url));
  const source = readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename.pathname,
  });
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  const require = (name) => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name);
  new Function('require', 'module', 'exports', outputText)(require, module, module.exports);
  return module.exports;
}
