import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { parseMessage, type Block, type InlineNode } from '../../lib/chat-markdown.ts';

/**
 * Renders the block tree from `lib/chat-markdown.ts`.
 *
 * All parsing lives in that module and is unit-tested; this file only decides
 * what each block looks like. The one thing it adds is link behaviour: an
 * internal `/path` is pushed onto the router, and an external URL is left inert
 * rather than opened, because `expo-linking` is installed but sending a
 * customer out of the app mid-conversation is a product decision, not a port.
 */

function Inline({ nodes }: { nodes: InlineNode[] }) {
  const router = useRouter();

  return (
    <>
      {nodes.map((node, i) => {
        if (node.kind === 'bold') {
          return (
            <Text key={i} className="font-semibold">
              {node.text}
            </Text>
          );
        }
        if (node.kind === 'link') {
          const internal = node.href.startsWith('/');
          return (
            <Text
              key={i}
              className="font-medium text-[#b20202] underline"
              onPress={internal ? () => router.push(node.href as never) : undefined}
            >
              {node.text}
            </Text>
          );
        }
        return <Text key={i}>{node.text}</Text>;
      })}
    </>
  );
}

function TableBlock({ block }: { block: Extract<Block, { kind: 'table' }> }) {
  // A markdown table has no width RN can compute from the text, so it scrolls
  // horizontally inside the bubble rather than squeezing every column.
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="my-1.5">
      <View className="overflow-hidden rounded-lg border border-gray-200">
        <View className="flex-row bg-gray-50">
          {block.header.map((cell, j) => (
            <View key={j} className="min-w-[90px] border-b border-gray-200 px-2 py-1">
              <Text className="text-[10px] font-semibold text-gray-800">
                <Inline nodes={cell} />
              </Text>
            </View>
          ))}
        </View>
        {block.rows.map((row, ri) => (
          <View key={ri} className={`flex-row ${ri % 2 ? 'bg-gray-50/50' : ''}`}>
            {row.map((cell, j) => (
              <View key={j} className="min-w-[90px] border-b border-gray-100 px-2 py-1">
                <Text className="text-[10px] text-gray-700">
                  <Inline nodes={cell} />
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function ChatMessageBody({ text, tint }: { text: string; tint: 'user' | 'assistant' }) {
  const blocks = parseMessage(text);
  const body = tint === 'user' ? 'text-white' : 'text-gray-800';

  return (
    <View>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'blank':
            return <View key={i} className="h-2" />;

          case 'divider':
            return <View key={i} className="my-2 h-px bg-gray-100" />;

          case 'header':
            return (
              <Text key={i} className={`mb-0.5 mt-3 text-sm font-semibold ${body}`}>
                {block.text}
              </Text>
            );

          case 'bullet':
            return (
              <View key={i} className={`my-0.5 flex-row gap-2 ${block.nested ? 'ml-4' : 'ml-1'}`}>
                <View
                  className={`mt-2 h-1 w-1 rounded-full ${
                    block.nested ? 'bg-red-300' : 'bg-[#b20202]'
                  }`}
                />
                <Text className={`flex-1 text-sm leading-snug ${body}`}>
                  <Inline nodes={block.content} />
                </Text>
              </View>
            );

          case 'numbered':
            return (
              <View key={i} className="my-0.5 ml-1 flex-row gap-2">
                <Text className="text-xs font-semibold text-[#b20202]">{block.marker}.</Text>
                <Text className={`flex-1 text-sm leading-snug ${body}`}>
                  <Inline nodes={block.content} />
                </Text>
              </View>
            );

          case 'table':
            return <TableBlock key={i} block={block} />;

          default:
            return (
              <Text key={i} className={`my-0.5 text-sm leading-snug ${body}`}>
                <Inline nodes={block.content} />
              </Text>
            );
        }
      })}
    </View>
  );
}
