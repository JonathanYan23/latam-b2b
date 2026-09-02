import type {
  CustomerPrice,
  CustomerRelationship,
  Product,
  RelationshipStatus,
  SellingMode,
} from "@prisma/client";

export interface PriceView {
  /** 用户当前可看到的价格（客户价优先，其次公开价） */
  price: number | null;
  /** 价格类型 */
  priceType: "PUBLIC" | "CUSTOMER" | null;
  /** 是否可下单 */
  purchasable: boolean;
  /** 是否必须申请客户关系后才能看到价格 */
  requiresRequest: boolean;
  /** 关系状态（用于展示申请进度） */
  relationshipStatus?: RelationshipStatus;
}

/**
 * 计算商品对某个零售商的价格视图。
 * PRD 第六~八节：公开购买 / Wholesale Customer Pricing / 独立客户关系。
 */
export function priceView(
  product: Pick<Product, "sellingMode" | "publicPrice">,
  relationship: Pick<CustomerRelationship, "status"> | null | undefined,
  customerPrice: Pick<CustomerPrice, "price"> | null | undefined,
): PriceView {
  const mode = product.sellingMode as SellingMode;
  const approved = relationship?.status === "APPROVED";

  // 已批准客户且有专属价 → 客户价
  if (approved && customerPrice) {
    return {
      price: Number(customerPrice.price),
      priceType: "CUSTOMER",
      purchasable: true,
      requiresRequest: false,
      relationshipStatus: relationship.status,
    };
  }

  switch (mode) {
    case "PUBLIC":
      return {
        price: product.publicPrice ? Number(product.publicPrice) : null,
        priceType: product.publicPrice ? "PUBLIC" : null,
        purchasable: !!product.publicPrice,
        requiresRequest: false,
        relationshipStatus: relationship?.status,
      };
    case "BOTH":
      // 无专属价时退回公开价；已批准无专属价也可按公开价购买
      return {
        price: product.publicPrice ? Number(product.publicPrice) : null,
        priceType: product.publicPrice ? "PUBLIC" : null,
        purchasable: !!product.publicPrice,
        requiresRequest: false,
        relationshipStatus: relationship?.status,
      };
    case "CUSTOMER_ONLY":
      return {
        price: null,
        priceType: null,
        purchasable: false,
        requiresRequest: true,
        relationshipStatus: relationship?.status,
      };
  }
}

/** 解析商品图片 JSON（兼容单图字符串） */
export function parseImages(images: string | null | undefined): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed : [images];
  } catch {
    return [images];
  }
}
