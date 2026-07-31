import type { ReactNode } from 'react'

export type ExhibitId = 'about' | 'work' | 'writing'

export type Exhibit = {
  id: ExhibitId
  order: string
  label: string
  title: string
  deck: string
  meta: string
  accent: string
}

export const exhibits: Exhibit[] = [
  {
    id: 'about',
    order: '01',
    label: 'ABOUT / CV',
    title: 'A builder between models and worlds.',
    deck: 'A short CV for a long-running curiosity.',
    meta: 'ZJU 26 / CUHK MSc AI / PHY XIFORMA CEO',
    accent: '#d17837',
  },
  {
    id: 'work',
    order: '02',
    label: 'WORK / PHY XIFORMA',
    title: 'Serious 3D assets for agentic interfaces.',
    deck: 'Research notes on giving language models a body in space.',
    meta: 'OPEN SOURCE / 2024 - NOW',
    accent: '#426f63',
  },
  {
    id: 'writing',
    order: '03',
    label: 'WRITING / FIELD NOTE 07',
    title: 'The interface is the territory.',
    deck: 'A field note on why tools should feel more like places.',
    meta: 'ESSAY / 08 MIN READ / 2025.06',
    accent: '#b34a4d',
  },
]

export function getExhibit(id: ExhibitId): Exhibit {
  const exhibit = exhibits.find((item) => item.id === id)
  if (!exhibit) {
    throw new Error(`Unknown exhibit: ${id}`)
  }
  return exhibit
}

export function ExhibitArticle({ exhibit }: { exhibit: Exhibit }): ReactNode {
  return (
    <article className="article-content" data-exhibit={exhibit.id}>
      <header className="article-header">
        <p className="article-label">{exhibit.label}</p>
        <h1>{exhibit.title}</h1>
        <p className="article-deck">{exhibit.deck}</p>
        <p className="article-meta">{exhibit.meta}</p>
      </header>
      {exhibit.id === 'about' && <AboutArticle />}
      {exhibit.id === 'work' && <WorkArticle />}
      {exhibit.id === 'writing' && <WritingArticle />}
      <footer className="article-footer">
        <span>DINOMUSEUM / NIJINZHE</span>
        <span>{exhibit.order} / 03</span>
      </footer>
    </article>
  )
}

function AboutArticle() {
  return (
    <div className="article-body">
      <p className="article-lede">
        Nijinzhe (倪旌哲) is a builder working at the boundary between intelligent systems and the
        physical imagination of 3D software.
      </p>
      <section className="about-live-card" aria-label="Live portfolio status">
        <p className="about-live-status">
          <span className="about-live-pulse" aria-hidden="true" />
          Live HTML / native paint
        </p>
        <p className="about-live-copy">Building spatial interfaces in public.</p>
        <a
          className="github-cta"
          href="https://github.com/NiJingzhe"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit Nijinzhe on GitHub (opens in a new tab)"
          data-crosshair-action="github"
        >
          <span>Explore GitHub</span>
          <span className="github-cta-arrow" aria-hidden="true">↗</span>
        </a>
      </section>
      <h2>Now</h2>
      <p>
        CEO at <strong>PhyXiForma</strong>, making interfaces for LM-based agents to understand and
        interact with serious 3D assets. The work is about turning a scene from a picture into a
        place an agent can inspect, remember, and act inside.
      </p>
      <h2>Education</h2>
      <ul>
        <li>Zhejiang University / class of 2026</li>
        <li>The Chinese University of Hong Kong / MSc in Artificial Intelligence</li>
      </ul>
      <h2>Working principles</h2>
      <p>
        Make the system legible. Make the interface generous. Keep a sharp boundary between what a
        model knows and what the world actually contains.
      </p>
      <div className="article-callout">
        <span>01</span>
        <p>Good tools do not hide complexity. They give complexity a room with windows.</p>
      </div>
    </div>
  )
}

function WorkArticle() {
  return (
    <div className="article-body">
      <p className="article-lede">
        PhyXiForma is an open-ended studio for the missing interface between language and spatial
        assets.
      </p>
      <h2>The question</h2>
      <p>
        A language model can describe a chair, but description is not the same as understanding a
        chair. We are exploring the tools that let an agent navigate a Blender scene, locate an
        object, reason about its geometry, and make a useful change without reducing the scene to
        a flat screenshot.
      </p>
      <h2>Current experiments</h2>
      <ul>
        <li>Scene graphs that preserve object identity and spatial relationships</li>
        <li>Visual interfaces for inspecting assets with language as the control surface</li>
        <li>Evaluation tasks grounded in real production files, not toy worlds</li>
      </ul>
      <h2>Why it matters</h2>
      <p>
        The next generation of creative software should let people and agents share a place. The
        interface is not a layer placed on top of the asset; it is the way the asset becomes
        available for thought.
      </p>
      <div className="article-callout">
        <span>02</span>
        <p>Spatial context is memory with coordinates.</p>
      </div>
    </div>
  )
}

function WritingArticle() {
  return (
    <div className="article-body">
      <p className="article-lede">
        Interfaces teach us what kind of world we are in. A list says: choose. A canvas says:
        make. A room says: stay a while and notice.
      </p>
      <h2>01 / Tools need atmosphere</h2>
      <p>
        We have spent years flattening work into panels, tabs, and infinite feeds. That is useful
        for retrieval, but poor at creating a durable sense of place. When an interface has
        atmosphere, returning to it feels less like opening software and more like entering a
        workshop where the unfinished things are still waiting.
      </p>
      <h2>02 / Space creates sequence</h2>
      <p>
        A gallery is a gentle constraint on attention. It asks you to walk, to encounter one
        thing before the next, and to build meaning from the distance between objects. For a
        portfolio, that sequence is the difference between presenting a pile of work and telling
        someone how to look at it.
      </p>
      <h2>03 / Leave room for the visitor</h2>
      <p>
        The best interface is not the one that performs the most. It is the one that gives the
        visitor enough cues to become curious, then gets out of the way. A small prompt, a warm
        light, a readable wall: sometimes that is the whole interaction.
      </p>
      <div className="article-callout">
        <span>03</span>
        <p>Design the threshold. Let the visitor make the meaning.</p>
      </div>
    </div>
  )
}
