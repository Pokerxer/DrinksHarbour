// The catalogue decision is already saved. Notification outages must not turn
// a successful approval/rejection into a failed catalogue operation.
async function notifyProductDecision(product, actorId) {
  if (!product.submittingTenant) return;
  const notifications = require("./notification.service");
  try {
    const result =
      product.status === "approved"
        ? await notifications.sendProductApprovedNotification(
            product._id,
            actorId,
            product,
          )
        : await notifications.sendProductRejectedNotification(
            product._id,
            actorId,
            product.rejectedReason,
            product,
          );
    if (result?.success === false)
      console.error("[product-decision] notification failed:", result.error);
  } catch (error) {
    console.error("[product-decision] notification failed:", error.message);
  }
}
module.exports = { notifyProductDecision };
