// Pure sales-document money contract, shared by the server and editor.
const finite = (value) =>
  Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const money = (value) =>
  Math.round((finite(value) + Number.EPSILON) * 100) / 100;
function lineAmounts(line) {
  if (line.lineType && line.lineType !== "product")
    return {
      gross: 0,
      discount: 0,
      promotion: 0,
      afterDiscount: 0,
      untaxed: 0,
      tax: 0,
      total: 0,
    };
  const gross = money(finite(line.unitPrice) * finite(line.quantity));
  const discount = money(
    Math.min(
      gross,
      line.discountType === "percentage"
        ? (gross * Math.min(100, finite(line.discount))) / 100
        : finite(line.discount),
    ),
  );
  const afterDiscount = money(gross - discount);
  const promotion = money(Math.min(afterDiscount, finite(line.promoDiscount)));
  const untaxed = money(afterDiscount - promotion);
  const tax = money((untaxed * Math.min(100, finite(line.taxRate))) / 100);
  return {
    gross,
    discount,
    promotion,
    afterDiscount,
    untaxed,
    tax,
    total: money(untaxed + tax),
  };
}
function convertDiscount(line, discountType) {
  const { gross, discount } = lineAmounts(line);
  // Retain percentage precision to keep the resolved reduction unchanged to kobo.
  return {
    discountType,
    discount:
      discountType === "percentage"
        ? gross > 0
          ? Number(((discount / gross) * 100).toFixed(8))
          : 0
        : discount,
  };
}
function documentAmounts(lines) {
  const rows = lines.map(lineAmounts);
  const sum = (key) => money(rows.reduce((total, row) => total + row[key], 0));
  return {
    subtotal: sum("gross"),
    discountTotal: sum("discount"),
    promotionTotal: sum("promotion"),
    taxTotal: sum("tax"),
    untaxed: sum("untaxed"),
    total: sum("total"),
  };
}
function documentTotal({
  subtotal = 0,
  discountTotal = 0,
  promotionTotal = 0,
  taxTotal = 0,
  couponDiscount = 0,
  pricelistCartDiscount = 0,
  shippingFee = 0,
}) {
  return money(
    money(
      Math.max(
        0,
        money(subtotal) - money(discountTotal) - money(promotionTotal),
      ) +
        money(taxTotal) -
        money(couponDiscount) -
        money(pricelistCartDiscount),
    ) + money(shippingFee),
  );
}
module.exports = {
  money,
  lineAmounts,
  convertDiscount,
  documentAmounts,
  documentTotal,
};
