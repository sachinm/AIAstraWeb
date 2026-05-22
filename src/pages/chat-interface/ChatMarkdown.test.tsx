import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatMarkdownComponents } from './ChatMarkdown';

describe('chatMarkdownComponents', () => {
  it('wraps GFM tables in a horizontally scrollable container', () => {
    const markdown = `| A | B |\n|---|---|\n| 1 | 2 |`;

    const { container } = render(
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
        {markdown}
      </ReactMarkdown>
    );

    const wrapper = container.querySelector('.overflow-x-auto');
    expect(wrapper).toBeTruthy();
    expect(wrapper?.querySelector('table')).toBeTruthy();
  });

  it('renders https images only', () => {
    render(
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
        {'![chart](https://example.com/chart.png)\n![bad](http://evil.com/x.png)'}
      </ReactMarkdown>
    );

    expect(screen.getByRole('img', { name: 'chart' })).toHaveAttribute(
      'src',
      'https://example.com/chart.png'
    );
    expect(screen.queryByRole('img', { name: 'bad' })).toBeNull();
  });
});
