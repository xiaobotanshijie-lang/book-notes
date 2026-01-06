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
  created_at: string;
}

export default function App() {
  const [notes, setNotes] = useState<(Note & { comments: Comment[] })[]>([]);
  const [book, setBook] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchNotes = async () => {
    setLoading(true);
    const { data: notesData } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    const notesWithComments = await Promise.all(
      (notesData || []).map(async (note: Note) => {
        const { data: comments } = await supabase
          .from('comments')
          .select('*')
          .eq('note_id', note.id)
          .order('created_at', { ascending: false });
        return { ...note, comments: comments || [] };
      })
    );
    setNotes(notesWithComments);
    setLoading(false);
  };

  useEffect(() => { fetchNotes(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book.trim() || !content.trim()) return;
    await supabase.from('notes').insert({ book, content, likes: 0 });
    setBook('');
    setContent('');
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
      author: author.trim() || '匿名读者',
      text: text.trim(),
    });
    fetchNotes();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">读书笔记分享</h1>

        {/* 发布 */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-8">
          <input
            type="text" placeholder="书名" value={book} onChange={e => setBook(e.target.value)}
            className="w-full px-4 py-2 border rounded mb-4 focus:outline-none focus:border-blue-500" required
          />
          <textarea
            placeholder="写下你的读书笔记..." value={content} onChange={e => setContent(e.target.value)}
            rows={4} className="w-full px-4 py-2 border rounded mb-4 focus:outline-none focus:border-blue-500" required
          />
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
            发布笔记
          </button>
        </form>

        {/* 列表 */}
        {loading ? <p className="text-center text-gray-500">加载中...</p> : notes.map(note => (
          <div key={note.id} className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">{note.book}</h3>
            <p className="text-gray-700 mb-4 whitespace-pre-wrap">{note.content}</p>
            <div className="flex items-center gap-4 mb-4">
              <button onClick={() => handleLike(note.id, note.likes)}
                className="flex items-center gap-1 text-red-500 hover:text-red-600">
                ❤️ {note.likes}
              </button>
              <span className="text-sm text-gray-500">
                {new Date(note.created_at).toLocaleString('zh-CN')}
              </span>
            </div>

            {/* 评论区 */}
            <div className="border-t pt-4">
              <CommentForm noteId={note.id} onComment={fetchNotes} />
              {note.comments.map(c => (
                <div key={c.id} className="mt-3 pl-4 border-l-2 border-gray-200">
                  <p className="text-sm font-medium">{c.author}</p>
                  <p className="text-gray-700">{c.text}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(c.created_at).toLocaleString('zh-CN')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentForm({ noteId, onComment }: { noteId: number; onComment: () => void }) {
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from('comments').insert({
      note_id: noteId,
      author: author.trim() || '匿名读者',
      text: text.trim(),
    });
    setAuthor(''); setText(''); onComment();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-4">
      <input type="text" placeholder="你的名字（可留空）" value={author} onChange={e => setAuthor(e.target.value)}
        className="px-3 py-1 border rounded text-sm" />
      <div className="flex gap-2">
        <input type="text" placeholder="说点什么..." value={text} onChange={e => setText(e.target.value)}
          className="flex-1 px-3 py-1 border rounded text-sm" />
        <button type="submit" className="px-4 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm">
          评论
        </button>
      </div>
    </form>
  );
}
