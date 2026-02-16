// Helper function to assign colors to flavors
const getFlavorColor = (flavor) => {
    const colorMap = {
        'fruity': '#EF4444',
        'citrus': '#F59E0B',
        'tropical': '#10B981',
        'berry': '#EC4899',
        'vanilla': '#FBBF24',
        'caramel': '#D97706',
        'chocolate': '#78350F',
        'spicy': '#DC2626',
        'herbal': '#059669',
        'floral': '#8B5CF6',
        'smoky': '#4B5563',
        'oak': '#92400E',
        'dry': '#6B7280',
        'sweet': '#F472B6',
        'bitter': '#1E40AF'

    };
    return colorMap[flavor] || '#6B7280';
};


module.exports = getFlavorColor;