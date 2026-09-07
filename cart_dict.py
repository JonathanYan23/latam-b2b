import io

zh_cart_add = '''    cartTitle: "购物车",
    addedToast: "已加入购物车",
    viewCart: "查看购物车",
    continueShopping: "继续选购",
    goCheckout: "去结算",
    clearCart: "清空购物车",
    clearConfirm: "确定要清空购物车吗？",
    cartTotal: "合计",
    checkoutBack: "返回上一供应商继续选购",
'''
en_cart_add = '''    cartTitle: "Cart",
    addedToast: "Added to cart",
    viewCart: "View cart",
    continueShopping: "Continue shopping",
    goCheckout: "Check out",
    clearCart: "Clear cart",
    clearConfirm: "Clear the entire cart?",
    cartTotal: "Total",
    checkoutBack: "Back to previous supplier to keep shopping",
'''
es_cart_add = '''    cartTitle: "Carrito",
    addedToast: "Añadido al carrito",
    viewCart: "Ver carrito",
    continueShopping: "Seguir comprando",
    goCheckout: "Finalizar compra",
    clearCart: "Vaciar carrito",
    clearConfirm: "¿Vaciar todo el carrito?",
    cartTotal: "Total",
    checkoutBack: "Volver al proveedor anterior para seguir comprando",
'''

prod_map = {
    "zh": [("    addToOrder: \"加入订单\",", "    addToOrder: \"加入购物车\","),
           ("    added: \"已加入 — 查看订单\",", "    added: \"已加入 ✓\",")],
    "en": [("    addToOrder: \"Add to order\",", "    addToOrder: \"Add to cart\","),
           ("    added: \"Added — view order\",", "    added: \"Added ✓\",")],
    "es": [("    addToOrder: \"Agregar al pedido\",", "    addToOrder: \"Agregar al carrito\","),
           ("    added: \"Agregado — ver pedido\",", "    added: \"Agregado ✓\",")],
}

anchors = {
    "zh": '    minOrder: "最低订单额",',
    "en": '    minOrder: "Min. order",',
    "es": '    minOrder: "Pedido mín.",',
}

for f, block in [("zh", zh_cart_add), ("en", en_cart_add), ("es", es_cart_add)]:
    p = f"D:/latam-b2b/src/i18n/dict/{f}.ts"
    s = io.open(p, encoding="utf-8").read()
    for a, b in prod_map[f]:
        assert a in s, (f, a)
        s = s.replace(a, b, 1)
    a = anchors[f]
    assert a in s, (f, a)
    if "    cartTitle:" in s:
        print("exists", f)
    else:
        s = s.replace(a, a + "\n" + block.rstrip("\n"), 1)
    io.open(p, "w", encoding="utf-8").write(s)
    print("ok", f)
