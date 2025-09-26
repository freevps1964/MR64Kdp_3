import React from 'react';
import type { Project, LayoutTemplate } from '../types';

interface BookPreviewProps {
  project: Project | null;
  layout: LayoutTemplate;
}

const BookPreview: React.FC<BookPreviewProps> = ({ project, layout }) => {
  if (!project || !project.bookStructure) {
    return (
      <div className="book-preview-container flex items-center justify-center h-full text-neutral-medium">
        <p>No content to preview.</p>
      </div>
    );
  }

  const layoutClass = `layout-${layout.toLowerCase()}`;

  return (
    <div className={`book-preview-container ${layoutClass}`}>
      <div className="book-page">
        <h1 className="book-title">{project.projectTitle}</h1>
        {project.subtitle && <h2 className="book-subtitle">{project.subtitle}</h2>}
        {project.author && <p className="book-author">by {project.author}</p>}

        {project.bookStructure.chapters.map(chapter => (
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
      </div>
    </div>
  );
};

export default BookPreview;