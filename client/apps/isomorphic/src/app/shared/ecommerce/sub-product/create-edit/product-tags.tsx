// @ts-nocheck
'use client';

import { useState } from 'react';
import { Input, Button } from 'rizzui';
import cn from '@core/utils/class-names';
import FormGroup from '@/app/shared/form-group';
import { useFormContext } from 'react-hook-form';
import { PiTagBold, PiXBold, PiSparkle, PiSpinner } from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { geminiService } from '@/services/gemini.service';
import toast from 'react-hot-toast';

export default function ProductTags({ className }: { className?: string }) {
  const { data: session } = useSession();
  const [isGenerating, setIsGenerating] = useState(false);
  return (
    <FormGroup
      title="Product Tags"
      description="Add your product's tag or category here"
      className={cn(className)}
    >
      <AutoGenerateTags
        isGenerating={isGenerating}
        setIsGenerating={setIsGenerating}
      />
      <ItemCrud name="Tag" />
    </FormGroup>
  );
}

function AutoGenerateTags({ isGenerating, setIsGenerating }: { isGenerating: boolean; setIsGenerating: (v: boolean) => void }) {
  const { watch, setValue } = useFormContext();
  const productName = watch('name') || '';
  const productType = watch('type') || '';
  const category = watch('category');

  const handleAutoGenerate = async () => {
    if (!productName || productName.length < 3) {
      toast.error('Please enter a product name first');
      return;
    }

    if (!session?.user?.token) {
      toast.error('Please sign in to use AI features');
      return;
    }

    setIsGenerating(true);
    toast.loading('Generating tags with AI...', { id: 'ai-tags' });

    try {
      const response = await geminiService.generateTags(
        productName,
        session.user.token,
        productType
      );

      const data = response.data;
      const tags = data.tags || [];

      setValue('tags', tags);
      toast.success('Tags generated!', { id: 'ai-tags' });
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast.error(error.message || 'Failed to generate tags', { id: 'ai-tags' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mb-4 flex justify-end">
      <Button
        type="button"
        size="sm"
        variant="outline"
        color="primary"
        disabled={!productName || productName.length < 3 || isGenerating}
        onClick={handleAutoGenerate}
        className="gap-1"
      >
        {isGenerating ? (
          <>
            <PiSpinner className="h-3 w-3 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <PiSparkle className="h-3 w-3" />
            Auto-generate with AI
          </>
        )}
      </Button>
    </div>
  );
}

function ItemCrud({ name }: { name: string }) {
  const { register, setValue, watch } = useFormContext();
  const [itemText, setItemText] = useState<string>('');
  const [items, setItems] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>(watch('tags') || []);

  function handleItemAdd(): void {
    if (itemText.trim() !== '') {
      const newItem: string = itemText;

      setItems([...items, newItem]);
      setValue('tags', [...items, newItem]);
      setItemText('');
    }
  }

  function handleItemRemove(text: string): void {
    const updatedItems = items.filter((item) => item !== text);
    setItems(updatedItems);
  }

  return (
    <div>
      <div className="flex items-center">
        <Input
          value={itemText}
          placeholder={`Enter a ${name}`}
          onChange={(e) => setItemText(e.target.value)}
          prefix={<PiTagBold className="h-4 w-4" />}
          className="w-full"
        />
        <input type="hidden" {...register('tags', { value: items })} />
        <Button
          onClick={handleItemAdd}
          className="ms-4 shrink-0 text-sm @lg:ms-5"
        >
          Add {name}
        </Button>
      </div>

      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((text, index) => (
            <div
              key={index}
              className="flex items-center rounded-full border border-gray-300 py-1 pe-2.5 ps-3 text-sm font-medium text-gray-700"
            >
              {text}
              <button
                onClick={() => handleItemRemove(text)}
                className="ps-2 text-gray-500 hover:text-gray-900"
              >
                <PiXBold className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
