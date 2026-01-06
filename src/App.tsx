import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface Comment {
  id: number;
  author: string;
  text: string;
  created_at: string;
}

interface Note {
  id: number;
  book: string;
  content: string;
  likes: number;
  user_id: string;
  user_name: string;
  wechat_id?: string;
  created_at: string;
}

export default function App() {
  const [notes, setNotes] = useState<(Note & { comments: Comment[] })[]>([]);
  const [book, setBook] = useState('');
  const [content, setContent] = useState('');
  const [wechatId, setWechatId] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    fetchNotes();

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    const { data: notesData } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    const notesWithComments = await Promise.all(
      (notesData || []).map(async (note: any) => {
        const { data: comments } = await supabase
          .from('comments')
          .select('*')
          .eq('note_id', note.id)
          .order('created_at', { ascending: false });
        return { 
          ...note, 
          user_name: note.user_name || '匿名读者',
          comments: comments || [] 
        };
      })
    );
    setNotes(notesWithComments);
    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    let error;
    if (authMode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      error = signUpError;
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      error = signInError;
    }
    if (error) {
      alert(error.message);
    } else {
      setEmail('');
      setPassword('');
      setShowAuth(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('请先登录后再发布笔记');
      setShowAuth(true);
      return;
    }
    if (!book.trim() || !content.trim()) return;

    await supabase.from('notes').insert({
      book,
      content,
      likes: 0,
      user_id: user.id,
      user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '书友',
      wechat_id: wechatId.trim() || null
    });
    setBook('');
    setContent('');
    setWechatId('');
    fetchNotes();
  };

  const handleLike = async (id: number, currentLikes: number) => {
    await supabase.from('notes').update({ likes: currentLikes + 1 }).eq('id', id);
    fetchNotes();
  };

  const addComment = async (noteId: number, author: string, text: string) => {
    if (!text.trim()) return;
    await supabase.from('comments').insert({
      note_id: noteId,
      author: author.trim() || (user ? (user.email?.split('@')[0] || '书友') : '匿名读者'),
      text: text.trim(),
    });
    fetchNotes();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">读书笔记分享</h1>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">欢迎，{user.email?.split('@')[0]}</span>
              <button onClick={handleSignOut} className="text-sm text-red-600 hover:underline">
                退出登录
              </button
