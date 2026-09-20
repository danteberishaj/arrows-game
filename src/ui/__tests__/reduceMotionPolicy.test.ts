import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const PROJECT_ROOT = process.env.REDUCE_MOTION_POLICY_SOURCE_ROOT
  ? path.resolve(process.env.REDUCE_MOTION_POLICY_SOURCE_ROOT)
  : path.resolve(__dirname, '../../..');

const CONFIG_ANIMATIONS = new Set(['withTiming', 'withSpring', 'withDecay']);
const POSITIONAL_ANIMATIONS = new Map([
  ['withDelay', 2],
  ['withRepeat', 4],
]);

/**
 * Owned by W0-04: each component renders a static equivalent and does not
 * start its withTiming driver under reduced motion.
 */
const W0_04_STATIC_EQUIVALENT_EXEMPTIONS = new Set([
  'src/ui/BoardView.tsx#BlockerArrow',
  'src/ui/BoardView.tsx#ShakingArrow',
  'src/ui/BoardView.tsx#HintArrow',
  'src/ui/StaticBoardSurface.native.tsx#BlockerArrow',
  'src/ui/StaticBoardSurface.native.tsx#ShakingArrow',
  'src/ui/StaticBoardSurface.native.tsx#HintArrow',
]);

const REDUCE_MOTION_NEVER_ALLOW_LIST = new Set([
  'src/ui/BoardView.tsx#ExitTrail',
]);

interface SourceLocation {
  file: string;
  component: string;
  line: number;
}

interface ScanResult {
  violations: string[];
  encounteredExemptions: Set<string>;
  neverLocations: SourceLocation[];
}

function sourceFilesUnder(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') visit(absolute);
      } else if (/\.tsx?$/.test(entry.name)) {
        files.push(absolute);
      }
    }
  };

  visit(path.join(root, 'src'));
  files.push(path.join(root, 'App.tsx'));
  return files.sort();
}

function relativeFile(file: string): string {
  return path.relative(PROJECT_ROOT, file).split(path.sep).join('/');
}

function propertyName(node: ts.ObjectLiteralElementLike): string | null {
  if (!node.name) return null;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return null;
}

function hasReduceMotionConfig(call: ts.CallExpression, animationName: string): boolean {
  const configIndex = animationName === 'withDecay' ? 0 : 1;
  const config = call.arguments[configIndex];
  return !!config && ts.isObjectLiteralExpression(config) &&
    config.properties.some((property) => propertyName(property) === 'reduceMotion');
}

function isReduceMotionValue(node: ts.Expression | undefined): boolean {
  return !!node && ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) && node.expression.text === 'ReduceMotion';
}

function hasMethodCall(node: ts.Node, methodName: string): boolean {
  let found = false;
  const visit = (child: ts.Node) => {
    if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression) &&
        child.expression.name.text === methodName) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function componentName(node: ts.Node): string {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (ts.isFunctionExpression(current) && current.name) return current.name.text;
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
        ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) {
      return current.parent.name.text;
    }
  }
  return '<module>';
}

function scanPolicies(): ScanResult {
  const violations: string[] = [];
  const encounteredExemptions = new Set<string>();
  const neverLocations: SourceLocation[] = [];

  for (const absoluteFile of sourceFilesUnder(PROJECT_ROOT)) {
    const file = relativeFile(absoluteFile);
    const sourceText = fs.readFileSync(absoluteFile, 'utf8');
    const source = ts.createSourceFile(
      absoluteFile,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      absoluteFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const visit = (node: ts.Node) => {
      const component = componentName(node);
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const key = `${file}#${component}`;

      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === 'ReduceMotion' && node.name.text === 'Never') {
        neverLocations.push({ file, component, line });
      }

      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const animationName = node.expression.text;
        if (CONFIG_ANIMATIONS.has(animationName)) {
          if (W0_04_STATIC_EQUIVALENT_EXEMPTIONS.has(key) && animationName === 'withTiming') {
            encounteredExemptions.add(key);
          } else if (!hasReduceMotionConfig(node, animationName)) {
            violations.push(
              `${file}:${line} ${component} ${animationName} config has no reduceMotion policy`,
            );
          }
        }

        const reduceMotionIndex = POSITIONAL_ANIMATIONS.get(animationName);
        if (reduceMotionIndex !== undefined &&
            !isReduceMotionValue(node.arguments[reduceMotionIndex])) {
          violations.push(
            `${file}:${line} ${component} ${animationName} has no reduce-motion argument`,
          );
        }
      }

      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) &&
          (node.name.text === 'entering' || node.name.text === 'exiting') &&
          node.initializer && ts.isJsxExpression(node.initializer) &&
          node.initializer.expression && ts.isCallExpression(node.initializer.expression) &&
          !hasMethodCall(node.initializer.expression, 'reduceMotion')) {
        violations.push(
          `${file}:${line} ${component} ${node.name.text} builder chain has no .reduceMotion()`,
        );
      }

      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return { violations, encounteredExemptions, neverLocations };
}

describe('Reanimated reduced-motion policy', () => {
  const result = scanPolicies();

  test('every animation call site states its policy', () => {
    expect(result.violations).toEqual([]);
  });

  test('the W0-04 exemption names exactly the six static-equivalent drivers', () => {
    expect([...W0_04_STATIC_EQUIVALENT_EXEMPTIONS].sort()).toEqual([
      'src/ui/BoardView.tsx#BlockerArrow',
      'src/ui/BoardView.tsx#HintArrow',
      'src/ui/BoardView.tsx#ShakingArrow',
      'src/ui/StaticBoardSurface.native.tsx#BlockerArrow',
      'src/ui/StaticBoardSurface.native.tsx#HintArrow',
      'src/ui/StaticBoardSurface.native.tsx#ShakingArrow',
    ]);
    expect([...result.encounteredExemptions].sort()).toEqual(
      [...W0_04_STATIC_EQUIVALENT_EXEMPTIONS].sort(),
    );
  });

  test('ReduceMotion.Never is confined to BoardView ExitTrail', () => {
    expect(result.neverLocations.map(({ file, component }) => `${file}#${component}`)).toEqual(
      [...REDUCE_MOTION_NEVER_ALLOW_LIST],
    );
  });
});
