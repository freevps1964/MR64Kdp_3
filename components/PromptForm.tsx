import React from 'react';
import type { Project, LayoutTemplate, PageSize } from '../types';
import { useLocalization } from '../hooks/useLocalization';

interface BookPreviewProps {
  project: Project | null;
  layout: LayoutTemplate;
  pageSize: PageSize;
}

const BookPreview: React.FC<BookPreviewProps> = ({ project, layout, pageSize }) => {
  const { t } = useLocalization();

  if (!project) {
    return (
      <div className="book-preview-container flex items-center justify-center h-full text-neutral-medium">
        <p>No project data.</p>
      </div>
    );
  }

  const hasContent = project.bookStructure && project.bookStructure.chapters.length > 0;
  const hasAppendixContent = project.contentBlocks && project.contentBlocks.length > 0;

  if (!hasContent && !hasAppendixContent) {
    return (
      <div className="book-preview-container flex items-center justify-center h-full text-neutral-medium">
        <p>No content to preview.</p>
      </div>
    );
  }


  const layoutClass = `layout-${layout.toLowerCase()}`;
  const sizeClass = `size-${pageSize}`;

  return (
    <div className={`book-preview-container ${sizeClass} ${layoutClass}`}>
      <div className="book-page">
        <h1 className="book-title">{project.bookTitle || project.projectTitle}</h1>
        {project.subtitle && <h2 className="book-subtitle">{project.subtitle}</h2>}
        {project.author && <p className="book-author">by {project.author}</p>}

        {project.bookStructure?.chapters.map(chapter => (
          <div key={chapter.id} className="chapter-container">
            <h3 className="chapter-title">{chapter.title}</h3>
            {chapter.content && <div className="content-block" dangerouslySetInnerHTML={{ __html: chapter.content.replace(/\n/g, '<br />') }}></div>}
            
            {chapter.subchapters.map(subchapter => (
              <div key={subchapter.id} className="subchapter-container">
                <h4 className="subchapter-title">{subchapter.title}</h4>
                {subchapter.content && <div className="content-block" dangerouslySetInnerHTML={{ __html: subchapter.content.replace(/\n/g, '<br />') }}></div>}
              </div>
            ))}
          </div>
        ))}

        {hasAppendixContent && (
          <div className="chapter-container appendix-container">
            <h3 className="chapter-title">{t('layoutTab.appendix')}</h3>
            {project.contentBlocks.map(block => (
              <div key={block.id} className="subchapter-container">
                <h4 className="subchapter-title">{block.title}</h4>
                <div className="content-block" dangerouslySetInnerHTML={{ __html: block.textContent.replace(/\n/g, '<br />') }}></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookPreview;