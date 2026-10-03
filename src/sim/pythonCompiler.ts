// Internal scheduling only: student source keeps ordinary def/call syntax.
// AST locations are preserved so tracebacks refer to the student's own lines.
const PYTHON_COMPILE_BASE = `
import ast as _student_ast, inspect as _student_inspect, asyncio as _student_asyncio

async def __student_result(value):
    if _student_inspect.isawaitable(value):
        return await value
    return value

__student_steps = 0
async def __student_tick():
    global __student_steps
    __student_steps += 1
    if __student_steps > 100000:
        raise RuntimeError("Program exceeded the 100,000 loop-iteration limit")
    if __student_steps % 1000 == 0:
        await _student_asyncio.sleep(0)

class __StudentCompiler(_student_ast.NodeTransformer):
    def reject(self, node, description):
        raise SyntaxError("Unsupported simulator Python: " + description,
                          ('<student-program>', node.lineno, node.col_offset + 1, _student_source.splitlines()[node.lineno - 1]))

    def visit_ClassDef(self, node): self.reject(node, "classes")
    def visit_Lambda(self, node): self.reject(node, "lambda; use def")
    def visit_Yield(self, node): self.reject(node, "generators/yield")
    def visit_YieldFrom(self, node): self.reject(node, "generators/yield")
    def visit_GeneratorExp(self, node): self.reject(node, "generator expressions")
    def visit_ListComp(self, node): self.reject(node, "comprehensions; use a for loop")
    def visit_SetComp(self, node): self.reject(node, "comprehensions; use a for loop")
    def visit_DictComp(self, node): self.reject(node, "comprehensions; use a for loop")
    def visit_With(self, node): self.reject(node, "context managers")
    def visit_AsyncWith(self, node): self.reject(node, "context managers")
    def visit_AsyncFor(self, node): self.reject(node, "async iterators")

    def visit_Name(self, node):
        if node.id in ("StopIteration", "StopAsyncIteration"):
            self.reject(node, "iterator protocol / StopIteration")
        return node

    def visit_Attribute(self, node):
        if node.attr in ("StopIteration", "StopAsyncIteration", "__next__", "__iter__", "__anext__", "__aiter__"):
            self.reject(node, "iterator protocol")
        return self.generic_visit(node)

    def function(self, node):
        annotations = [arg.annotation for arg in node.args.posonlyargs + node.args.args + node.args.kwonlyargs]
        annotations += [node.returns]
        if node.args.vararg: annotations.append(node.args.vararg.annotation)
        if node.args.kwarg: annotations.append(node.args.kwarg.annotation)
        if any(isinstance(n, (_student_ast.Call, _student_ast.Await)) for annotation in annotations if annotation is not None for n in _student_ast.walk(annotation)):
            self.reject(node, "calls in function annotations")
        if node.decorator_list: self.reject(node, "decorators")
        defaults = node.args.defaults + [v for v in node.args.kw_defaults if v is not None]
        if any(isinstance(n, (_student_ast.Call, _student_ast.Await)) for v in defaults for n in _student_ast.walk(v)):
            self.reject(node, "calls in function defaults")
        # Defaults/annotations are definition-time expressions, not scheduled bodies.
        node.body = [self.visit(statement) for statement in node.body]
        replacement = _student_ast.AsyncFunctionDef(name=node.name, args=node.args, body=node.body,
            decorator_list=[], returns=node.returns, type_comment=node.type_comment)
        return _student_ast.copy_location(replacement, node)
    visit_FunctionDef = function
    visit_AsyncFunctionDef = function

    def call(self, node):
        node.func = self.visit(node.func)
        node.args = [self.visit(arg) for arg in node.args]
        node.keywords = [self.visit(keyword) for keyword in node.keywords]
        return node

    def visit_Call(self, node):
        if isinstance(node.func, _student_ast.Name) and node.func.id in ("next", "iter", "anext", "aiter"):
            self.reject(node, "iterator protocol / next/iter")
        if isinstance(node.func, _student_ast.Name) and (node.func.id in ("map", "filter") or (node.func.id == "sorted" and any(k.arg == "key" for k in node.keywords))):
            self.reject(node, "callback-based higher-order calls; use a for loop")
        node = self.call(node)
        wrapped = _student_ast.Await(value=_student_ast.Call(func=_student_ast.Name(id='__student_result', ctx=_student_ast.Load()), args=[node], keywords=[]))
        return _student_ast.copy_location(wrapped, node)

    def visit_Await(self, node):
        # Saved explicit-await programs stay valid, without awaiting a resolved value twice.
        if isinstance(node.value, _student_ast.Call): node.value = self.call(node.value)
        else: node.value = self.visit(node.value)
        return node

    def loop(self, node):
        node = self.generic_visit(node)
        tick = _student_ast.Expr(value=_student_ast.Await(value=_student_ast.Call(func=_student_ast.Name(id='__student_tick', ctx=_student_ast.Load()), args=[], keywords=[])))
        node.body.insert(0, _student_ast.copy_location(tick, node))
        return node
    visit_For = loop
    visit_While = loop

__student_tree = __StudentCompiler().visit(_student_ast.parse(_student_source, filename='<student-program>'))
_student_ast.fix_missing_locations(__student_tree)
__student_code = compile(__student_tree, '<student-program>', 'exec', flags=_student_ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
`;

export const PYTHON_COMPILER = PYTHON_COMPILE_BASE + "\nawait __student_result(eval(__student_code, globals()))\n";

// Compile the same supported subset for the coach, without evaluating user code.
export const PYTHON_COMPILER_CHECK = PYTHON_COMPILE_BASE;
