const Tag = require("../models/tag");
const { generateUniqueSlug } = require("../utils/slugify");

const resolveTagReferences = async (tags) => {
    const tagIds = [];
    const tagNames = tags.map(tag => 
        typeof tag === 'string' ? tag.toLowerCase() : tag
    );
    
    // Find existing tags
    const existingTags = await Tag.find({
        $or: [
            { _id: { $in: tags.filter(t => typeof t !== 'string') } },
            { name: { $in: tagNames.filter(n => typeof n === 'string') } }
        ]
    });
    
    // Map existing tags
    const existingTagNames = existingTags.map(tag => tag.name);
    tagIds.push(...existingTags.map(tag => tag._id));
    
    // Create new tags
    const newTagNames = tagNames.filter(name => 
        typeof name === 'string' && !existingTagNames.includes(name)
    );
    
    for (const tagName of newTagNames) {
        const newTag = await Tag.create({
            name: tagName,
            slug: generateUniqueSlug(tagName),
            type: 'general',
            status: 'active'
        });
        tagIds.push(newTag._id);
    }
    
    return tagIds;
};

module.exports = resolveTagReferences;