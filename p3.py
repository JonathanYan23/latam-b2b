import io
# dict: yourPrice → 专享价
zh_v = io.open("D:/latam-b2b/src/i18n/dict/zh.ts", encoding="utf-8").read()
zh_v = zh_v.replace('yourPrice: "你的价格"', 'yourPrice: "专享价"')
io.open("D:/latam-b2b/src/i18n/dict/zh.ts", "w", encoding="utf-8").write(zh_v)
en_v = io.open("D:/latam-b2b/src/i18n/dict/en.ts", encoding="utf-8").read()
en_v = en_v.replace('yourPrice: "Your price"', 'yourPrice: "Exclusive price"')
io.open("D:/latam-b2b/src/i18n/dict/en.ts", "w", encoding="utf-8").write(en_v)
es_v = io.open("D:/latam-b2b/src/i18n/dict/es.ts", encoding="utf-8").read()
es_v = es_v.replace('yourPrice: "Tu precio"', 'yourPrice: "Precio exclusivo"')
io.open("D:/latam-b2b/src/i18n/dict/es.ts", "w", encoding="utf-8").write(es_v)
print("yourPrice dict ok")

# account page 金额橙
p = "D:/latam-b2b/src/app/retailer/account/page.tsx"
s = io.open(p, encoding="utf-8").read()
a1 = '          <p className="mt-3 flex items-baseline gap-1.5 text-lg font-semibold">'
b1 = '          <p className="amount mt-3 flex items-baseline gap-1.5 text-lg">'
assert a1 in s; s = s.replace(a1, b1, 1)
a2 = '                  <td className="px-5 py-3.5 font-semibold">{money(w.outstanding, cur)}</td>'
b2 = '                  <td className="amount px-5 py-3.5">{money(w.outstanding, cur)}</td>'
if a2 in s: s = s.replace(a2, b2, 1)
a3 = '                <p className="text-base font-semibold">{money(inv.amount, cur)}</p>'
b3 = '                <p className="amount text-base">{money(inv.amount, cur)}</p>'
if a3 in s: s = s.replace(a3, b3, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("account page ok")
