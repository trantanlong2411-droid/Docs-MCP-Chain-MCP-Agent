import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {HTML} from '../src/page.mjs';
test('Two selectable function scenarios, sourced explanations and proof export',()=>{
 for(const phrase of ['latestAnswer()','latestTimestamp()','Developer Docs MCP','Chain MCP','Export JSON proof'])
  assert.ok(HTML.includes(phrase),phrase);
});
test('browser script syntax is valid',()=>{
 const match=HTML.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match);new Script(match[1]);
});
