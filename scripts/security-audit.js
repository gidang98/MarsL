#!/usr/bin/env node
// MarsL Security Audit Script
// Run with: node scripts/security-audit.js

const fs = require('fs');
const path = require('path');

const issues = [];

function audit(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for SQL injection risks
    if (/db\.prepare\s*\(\s*[`"'].*\$\{/.test(line)) {
      issues.push({ file: filePath, line: lineNum, severity: 'HIGH', issue: 'Potential SQL injection via template literal in db.prepare', code: line.trim() });
    }

    // Check for eval usage
    if (/eval\s*\(/.test(line)) {
      issues.push({ file: filePath, line: lineNum, severity: 'HIGH', issue: 'eval() usage detected', code: line.trim() });
    }

    // Check for hardcoded secrets
    if (/(password|secret|token|key)\s*[=:]\s*['"][^'"]{8,}['"]/i.test(line) && !/process\.env/.test(line)) {
      issues.push({ file: filePath, line: lineNum, severity: 'MEDIUM', issue: 'Possible hardcoded secret', code: line.trim() });
    }

    // Check for console.log with sensitive data
    if (/console\.(log|warn|error)\s*\(.*(password|token|secret|cookie)/i.test(line)) {
      issues.push({ file: filePath, line: lineNum, severity: 'LOW', issue: 'Sensitive data may be logged', code: line.trim() });
    }
  }
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && file !== 'node_modules' && !file.startsWith('.')) {
      scanDir(fullPath);
    } else if (file.endsWith('.js')) {
      audit(fullPath);
    }
  }
}

console.log('MarsL Security Audit');
console.log('='.repeat(60));

scanDir(path.join(__dirname, '..'));

if (issues.length === 0) {
  console.log('\nNo security issues found!');
  process.exit(0);
} else {
  console.log(`\nFound ${issues.length} potential issue(s):\n`);
  for (const issue of issues) {
    console.log(`[${issue.severity}] ${path.basename(issue.file)}:${issue.line}`);
    console.log(`  ${issue.issue}`);
    console.log(`  ${issue.code.substring(0, 100)}`);
    console.log();
  }
  process.exit(1);
}
