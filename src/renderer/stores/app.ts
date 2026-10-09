import { create } from 'zustand';
import type { Project, Settings } from '../../shared/types';

export type Page = 'dashboard' | 'projects' | 'problem' | 'test-plan' | 'generator' | 'solution' | 'runner' | 'export' | 'settings';
interface AppState {
  projects: Project[];
  active: Project | null;
  settings: Settings | null;
  page: Page;
  dirty: boolean;
  setProjects: (projects: Project[]) => void;
  setActive: (project: Project | null) => void;
  setSettings: (settings: Settings) => void;
  setPage: (page: Page) => void;
  setDirty: (dirty: boolean) => void;
  updateActive: (update: Partial<Project>) => void;
}

export const useApp = create<AppState>((set) => ({
  projects: [], active: null, settings: null, page: 'dashboard', dirty: false,
  setProjects: (projects) => set({ projects }),
  setActive: (active) => set({ active, dirty: false }),
  setSettings: (settings) => set({ settings }),
  setPage: (page) => set({ page }),
  setDirty: (dirty) => set({ dirty }),
  updateActive: (update) => set((state) => state.active ? { active: { ...state.active, ...update }, dirty: true } : {}),
}));
