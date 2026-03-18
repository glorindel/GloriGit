# GloriGit — Task Plan

## Phase 0: Initialization ✅
- [x] Create project memory (project.md, findings.md, progress.md)
- [x] Research speed strategies & existing tools
- [x] Define data schemas & behavioral rules
- [/] Implementation plan → awaiting approval

## Phase 1: Blueprint (Build Foundation) ✅
- [x] Initialize `package.json` with minimal deps
- [x] Build `tools/git.js` — git command executor
- [x] Build `server.js` — HTTP + WebSocket server
- [x] Create architecture SOP

## Phase 2: Link (Verify Connectivity) ✅
- [x] Test git commands via child_process
- [x] Verify WebSocket handshake

## Phase 3: Architect (Core UI) ✅
- [x] HTML layout with all panels
- [x] CSS dark theme design system
- [x] Status panel (staged/unstaged/untracked files)
- [x] Diff viewer with syntax coloring
- [x] Commit panel
- [x] Branch switcher/creator
- [x] Log/history viewer (paginated)
- [x] Push/Pull controls

## Phase 4: Stylize (Polish) ✅
- [x] Micro-animations & transitions
- [x] Keyboard shortcuts
- [x] Error toasts & confirmations
- [x] Responsive layout

## Phase 5: Trigger (Ship) ✅
- [x] CLI launcher (bin field)
- [x] README.md documentation
- [x] .gitignore

## Phase 6: The Historian (Commit Inspection) ✅
- [x] Commit file browser (modified/added/deleted)
- [x] Back-in-time diff (click file in past commit to see diff)

## Phase 7: Conflict Warzone (Advanced Merging)
- [ ] Visual Conflict Resolver
- [ ] Interactive Rebase UI
- [ ] Merge Preview

## Phase 8: The Matrix (Visualization) ✅
- [x] Canvas Commit Graph
- [x] File History Timemachine
- [x] Author Impact Heatmap

## Phase 9: Deep Storage (Stashes & Remotes)
- [x] Stash Manager
- [ ] Remote Control UI (origin/upstream management)
- [ ] Tagging System

## Phase 10: Operator Tools
- [ ] Built-in Power Terminal
- [ ] Git Cheat Sheet overlay
- [ ] Search & Filter Highlighting
- [ ] Command Palette (Ctrl+K)

## Phase 11: Customization & Plugins
- [ ] Theme Studio (Day/Light theme & Neon customization)
- [ ] Web Sockets API for plugins

## Phase 12: New Features (Requested)
- [ ] Mergovanie
- [ ] Cherry picking
- [ ] Checkoutnutie na hociktory commit (detach head)
- [ ] Ovládanie cez pravý klik (Context menu)
- [ ] Pridať na vrchnú lištu zobrazenie všetkých súborov v repozitári + možnosť vyhľadávať podľa názvu
- [ ] Zanalyzovat a pripravit pokrocilu funkcionalitu pre submoduly
- [ ] Vždy pri súboroch zobrazovať ikonku hodin - historie vsetkych zmien ako ked je subor v stave modified/staged, kde toto ikonu zobrazujeme 

## Phase 13: UI Changes & Fixes (Requested) ✅
- [x] Horná lišta: buttony zprava dať na ľavú stranu a logo, názov repa, path dať na pravú stranu (Refined: Logo | Separator | Repo Info)
- [x] Zväčšiť dialóg na výber branche
- [x] Opraviť selectovanie verzií zmien v jednom súbore
- [x] V commit history v pravom stĺpčeku zobrazovať dátum a čas (full format)
- [x] História automaticky vyskrolovaná s pevnou výškou, ktorú môže užívateľ meniť
- [x] Jeden spoločný horizontálny scrollbar na spodku diff okna
