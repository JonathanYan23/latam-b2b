import io
p = "D:/latam-b2b/src/components/portal-shell.tsx"
s = io.open(p, encoding="utf-8").read()
a = 'className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors $'
b = 'className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors $'
assert a in s, "anchor1"
s = s.replace(a, b, 1)
a2 = ('isActive(item)\n'
      '                    ? "bg-[var(--color-bg-muted)] font-medium text-[var(--color-ink)]"\n'
      '                    : "text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"')
b2 = ('isActive(item)\n'
      '                    ? "font-medium text-[var(--color-ink)] after:absolute after:inset-x-2 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-[var(--color-ink)]"\n'
      '                    : "text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"')
assert a2 in s, "anchor2"
s = s.replace(a2, b2, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("nav underline ok")
