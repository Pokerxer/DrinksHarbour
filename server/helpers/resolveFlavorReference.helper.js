const Flavor = require("../models/Flavor");

// Helper function to resolve flavor references
const resolveFlavorReferences = async (flavors) => {
    const flavorIds = [];
    const flavorValues = flavors.map(flavor => 
        typeof flavor === 'string' ? flavor.toLowerCase() : flavor
    );
    
    // Find existing flavors
    const existingFlavors = await Flavor.find({
        $or: [
            { _id: { $in: flavors.filter(f => typeof f !== 'string') } },
            { value: { $in: flavorValues.filter(v => typeof v === 'string') } }
        ]
    });
    
    // Map existing flavors
    const existingFlavorValues = existingFlavors.map(flavor => flavor.value);
    flavorIds.push(...existingFlavors.map(flavor => flavor._id));
    
    // Create new flavors (only if they match predefined flavor profile?)
    const newFlavorValues = flavorValues.filter(value => 
        typeof value === 'string' && !existingFlavorValues.includes(value)
    );
    
    for (const flavorValue of newFlavorValues) {
        const newFlavor = await Flavor.create({
            name: flavorValue.charAt(0).toUpperCase() + flavorValue.slice(1),
            value: flavorValue,
            color: getFlavorColor(flavorValue),
            status: 'active'
        });
        flavorIds.push(newFlavor._id);
    }
    
    return flavorIds;
};

module.exports = resolveFlavorReferences;
