export type RoleName = 'client' | 'dispatcher' | 'specialist' | 'admin';

export interface Role {
  role_id: number;
  role_name: RoleName;
  description?: string;
}

export interface User {
  user_id: number;
  role_id: number;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  role?: Role;
}

export interface Category {
  category_id: number;
  category_name: string;
  description?: string;
}

export interface Priority {
  priority_id: number;
  priority_name: string;
  weight: number;
}

export interface Status {
  status_id: number;
  status_name: string;
  is_final: boolean;
}

export interface SLAPolicy {
  sla_id: number;
  priority_id: number;
  response_time_minutes: number;
  resolve_time_hours: number;
  priority?: Priority;
}

export interface Message {
  message_id: number;
  ticket_id: number;
  sender_id: number;
  message_text: string;
  is_internal: boolean;
  created_at: string;
  sender?: User;
}

export interface Attachment {
  attachment_id: number;
  ticket_id: number;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

export interface HistoryItem {
  history_id: number;
  old_status?: Status;
  new_status: Status;
  changed_at: string;
}

export interface Rating {
  rating_id: number;
  score: number;
  comment?: string;
  created_at: string;
}

export interface Ticket {
  ticket_id: number;
  title: string;
  description?: string;
  created_at: string;
  sla_deadline?: string;
  closed_at?: string;
  client: User;
  specialist?: User;
  dispatcher?: User;
  category: Category;
  priority: Priority;
  status: Status;
  messages?: Message[];
  attachments?: Attachment[];
  history?: HistoryItem[];
  rating?: Rating;
}

export interface KBArticle {
  kb_id: number;
  category_id: number;
  author_id: number;
  title: string;
  solution_text: string;
  created_at: string;
  category?: Category;
  author?: User;
}
