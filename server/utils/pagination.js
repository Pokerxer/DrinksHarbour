// ============================================================================
// utils/pagination.js
// ============================================================================

/**
 * Parse and validate pagination parameters
 */
const parsePagination = (page = 1, limit = 20) => {
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20)); // Max 100 items per page
  const skip = (parsedPage - 1) * parsedLimit;

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip,
  };
};

/**
 * Build pagination metadata for response
 */
const buildPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    currentPage: page,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

module.exports = {
  parsePagination,
  buildPaginationMeta,
};
