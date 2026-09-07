import io, re

def rep(path, pattern, repl):
    s = io.open(path, encoding="utf-8").read()
    s2, n = re.subn(pattern, repl, s, count=1, flags=re.S)
    io.open(path, "w", encoding="utf-8").write(s2)
    print(("ok" if n else "MISS"), path, "x" + str(n))

# 批发商品卡库存行 → 徽标化
pat = re.compile(
    r'(<div className="mt-3 flex items-center justify-between[^"]*px-3 py-2">)'
    r'.*?'
    r'(<StockUpdater productId=\{p\.id\} initial=\{stock\} t=\{t\} />\s*</div>)',
    re.S,
)
rep("D:/latam-b2b/src/app/wholesaler/products/page.tsx", pat,
    r'''\1
                  {stock <= 0 ? (
                    <span className="badge badge-danger shrink-0">{t.common.outOfStock}</span>
                  ) : stock < 20 ? (
                    <span className="badge badge-warning shrink-0">
                      {fmt("{l} · {n}", { l: t.common.lowStock, n: stock })}
                    </span>
                  ) : (
                    <span className="text-meta shrink-0 text-xs">
                      {fmt("{n} {u} " + t.common.inStock, { n: stock, u: t.common.units })}
                    </span>
                  )}
                  \2''')
print("done")
