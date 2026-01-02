'use client';

import { Text, Tooltip } from '@mantine/core';
import { Clock } from 'lucide-react';
import { formatSecondsToTimestamp } from '@/lib/timestamp-utils';

interface TimestampLinkProps {
  /** Timestamp in seconds */
  seconds: number;
  /** Optional display text (defaults to formatted timestamp) */
  displayText?: string;
  /** Callback when timestamp is clicked */
  onTimestampClick?: (seconds: number) => void;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
  /** Whether to show clock icon */
  showIcon?: boolean;
  /** Whether this is inline with text or standalone */
  inline?: boolean;
}

/**
 * Clickable timestamp link that triggers navigation to transcript/audio position
 */
export function TimestampLink({
  seconds,
  displayText,
  onTimestampClick,
  size = 'xs',
  showIcon = true,
  inline = true,
}: TimestampLinkProps) {
  const formattedTime = displayText || formatSecondsToTimestamp(seconds);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTimestampClick?.(seconds);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTimestampClick?.(seconds);
    }
  };

  if (!onTimestampClick) {
    // Non-interactive version - just display the timestamp
    return (
      <Text
        component="span"
        size={size}
        ff="monospace"
        c="dimmed"
        style={{ display: inline ? 'inline' : 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        {showIcon && <Clock size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} />}
        [{formattedTime}]
      </Text>
    );
  }

  // Interactive version - clickable button
  return (
    <Tooltip label={`Jump to ${formattedTime}`} openDelay={300}>
      <Text
        component="button"
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        size={size}
        ff="monospace"
        c="blue"
        aria-label={`Jump to timestamp ${formattedTime}`}
        style={{
          display: inline ? 'inline-flex' : 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 6px',
          margin: '0 2px',
          borderRadius: 4,
          border: 'none',
          background: 'var(--mantine-color-blue-light)',
          cursor: 'pointer',
          transition: 'all 150ms ease',
          verticalAlign: 'baseline',
        }}
        className="timestamp-link"
      >
        {showIcon && <Clock size={size === 'xs' ? 10 : size === 'sm' ? 12 : 14} />}
        {formattedTime}
      </Text>
    </Tooltip>
  );
}

/**
 * Renders text content with embedded timestamps as clickable links
 */
interface TextWithTimestampsProps {
  /** Text content that may contain [MM:SS] timestamps */
  text: string;
  /** Callback when any timestamp is clicked */
  onTimestampClick?: (seconds: number) => void;
  /** Text size */
  size?: 'xs' | 'sm' | 'md';
  /** Text color */
  c?: string;
  /** Component to wrap the text (default: span) */
  component?: 'span' | 'p' | 'div';
}

import { splitTextWithTimestamps } from '@/lib/timestamp-utils';

export function TextWithTimestamps({
  text,
  onTimestampClick,
  size = 'sm',
  c,
  component = 'span',
}: TextWithTimestampsProps) {
  const parts = splitTextWithTimestamps(text);

  // If no timestamps, return plain text
  if (parts.length === 1 && parts[0].type === 'text') {
    return (
      <Text component={component} size={size} c={c}>
        {text}
      </Text>
    );
  }

  return (
    <Text component={component} size={size} c={c} style={{ display: 'inline' }}>
      {parts.map((part, index) => {
        if (part.type === 'timestamp' && part.seconds !== undefined) {
          return (
            <TimestampLink
              key={`ts-${index}-${part.seconds}`}
              seconds={part.seconds}
              displayText={part.timestamp}
              onTimestampClick={onTimestampClick}
              size={size}
              showIcon={false}
              inline={true}
            />
          );
        }
        return <span key={`text-${index}`}>{part.content}</span>;
      })}
    </Text>
  );
}

export default TimestampLink;
