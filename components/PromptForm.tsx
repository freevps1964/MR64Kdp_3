import React from 'react';
import type { Project, LayoutTemplate, PageSize, CustomStyles } from '../types';
import { useLocalization } from '../hooks/useLocalization';

interface BookPreviewProps {
  project: Project | null;
  layout: LayoutTemplate;
  pageSize: PageSize;
  renderAllPages?: boolean;
}

const CustomStylesComponent: React.FC<{ styles: CustomStyles }> = ({ styles }) => {
  const css = `
    .layout-custom .book-title {
      font-family: '${styles.titleFont}', serif;
      font-size: ${styles.titleSize}pt;
    }
    .layout-custom .book-subtitle {
      font-family: '${styles.subtitleFont}', sans-serif;
      font-size: ${styles.subtitleSize}pt;
    }
    .layout-custom .chapter-title {
      font-family: '${styles.chapterTitleFont}', sans-serif;
      font-size: ${styles.chapterTitleSize}pt;
    }
     .layout-custom .subchapter-title {
      font-family: '${styles.chapterTitleFont}', sans-serif;
    }
    .layout-custom .content-block {
      font-family: '${styles.bodyFont}', serif;
      font-size: ${styles.bodySize}pt;
      line-height: ${styles.lineHeight};
    }
  `;
  return <style>{css}</style>;
};


const BookPreview: React.FC<BookPreviewProps> = ({ project, layout, pageSize, renderAllPages = false }) => {
  const { t } = useLocalization();

  if (!project) {
    return (
      <div className="book-preview-container flex items-center justify-center h-full text-neutral-medium">
        <p>No project data.</p>
      </div>
    );
  }

  const hasContent = project.bookStructure && project.bookStructure.chapters.length > 0;
  const hasRecipesOrExercises = project.contentBlocks && project.contentBlocks.some(b => b.type === 'recipe' || b.type === 'exercise');
  const hasBonusContent = project.contentBlocks && project.contentBlocks.some(b => b.type === 'bonus');
  const hasGlossaryContent = project.glossary && project.glossary.length > 0;

  if (!hasContent && !hasRecipesOrExercises && !hasBonusContent && !hasGlossaryContent) {
    return (
      <div className="book-preview-container flex items-center justify-center h-full text-neutral-medium">
        <p>No content to preview.</p>
      </div>
    );
  }


  const layoutClass = `layout-${layout.toLowerCase()}`;
  const sizeClass = `size-${pageSize}`;

  const pages: React.ReactNode[] = [];

  // Page 1: Title Page
  pages.push(
    <div key="title-page" className="book-page">
      <h1 className="book-title">{project.bookTitle || project.projectTitle}</h1>
      {project.subtitle && <h2 className="book-subtitle">{project.subtitle}</h2>}
      {project.author && <p className="book-author">by {project.author}</p>}
    </div>
  );

  // Subsequent pages: Chapters
  project.bookStructure?.chapters.forEach(chapter => {
    pages.push(
      <div key={chapter.id} className="book-page">
        <div className="chapter-container">
          <h3 className="chapter-title">{chapter.title}</h3>
          {chapter.content && <div className="content-block" dangerouslySetInnerHTML={{ __html: chapter.content }}></div>}
          
          {chapter.subchapters.map(subchapter => (
            <div key={subchapter.id} className="subchapter-container">
              <h4 className="subchapter-title">{subchapter.title}</h4>
              {subchapter.content && <div className="content-block" dangerouslySetInnerHTML={{ __html: subchapter.content }}></div>}
            </div>
          ))}
        </div>
      </div>
    );
  });
  
  // Recipes & Exercises Appendix Page
  if (hasRecipesOrExercises) {
    pages.push(
      <div key="recipes-exercises-page" className="book-page">
        <div className="chapter-container appendix-container">
          <h3 className="chapter-title">{t('tabs.recipes')}</h3>
          {project.contentBlocks.filter(b => b.type === 'recipe' || b.type === 'exercise').map(block => (
            <div key={block.id} className="subchapter-container">
              <h4 className="subchapter-title">{block.title}</h4>
              {block.imageUrl && <img src={block.imageUrl} alt={block.title} className="content-block-image" />}
              <div className="content-block" dangerouslySetInnerHTML={{ __html: block.textContent.replace(/\n/g, '<br />') }}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Bonus Appendix Page
  if (hasBonusContent) {
    pages.push(
      <div key="bonus-page" className="book-page">
        <div className="chapter-container appendix-container">
          <h3 className="chapter-title">{t('tabs.bonus')}</h3>
          {project.contentBlocks.filter(b => b.type === 'bonus').map(block => (
            <div key={block.id} className="subchapter-container">
              <h4 className="subchapter-title">{block.title}</h4>
              {block.imageUrl && <img src={block.imageUrl} alt={block.title} className="content-block-image" />}
              <div className="content-block" dangerouslySetInnerHTML={{ __html: block.textContent.replace(/\n/g, '<br />') }}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Glossary Page
  if (hasGlossaryContent) {
    const sortedGlossary = [...project.glossary].sort((a, b) => a.term.localeCompare(b.term));
    pages.push(
      <div key="glossary-page" className="book-page">
        <div className="chapter-container">
          <h3 className="chapter-title">{t('glossaryTab.title')}</h3>
          {sortedGlossary.map(item => (
            <div key={item.id} className="content-block" style={{ marginBottom: '1rem' }}>
              <strong style={{ fontWeight: 'bold' }}>{item.term}:</strong> {item.definition}
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  const pagesToRender = renderAllPages ? pages : pages.slice(0, 4);

  return (
    <>
    {layout === 'Custom' && project.customStyles && <CustomStylesComponent styles={project.customStyles} />}
    <div className={`book-preview-container ${sizeClass} ${layoutClass}`} id="book-preview-content">
      {pagesToRender.map((page, index) => 
        React.cloneElement(page as React.ReactElement<any>, {
          key: (page as React.ReactElement<any>).key || index,
          children: (
            <>
              {(page as React.ReactElement<any>).props.children}
              <div className="page-number">{index + 1}</div>
            </>
          )
        })
      )}
    </div>
    </>
  );
};

export default BookPreview;