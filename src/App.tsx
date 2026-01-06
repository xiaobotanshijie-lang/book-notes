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
  wechat_id?: string;  // 新增：微信号（可选）
  created_at: string;
}

export default function App() {
  const [notes, setNotes] = useState<(Note & { comments: Comment[] })[]>([]);
  const [book, setBook] = useState('');
  const [content, setContent] = useState('');
  const [wechatId, setWechatId] = useState('');  // 新增：微信号输入
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showAuth, setShowAuth] = useState(false);

  // 检查登录状态
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session)n => {
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

  // 登录 / 注册
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

  // 退出登录
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // 发布笔记
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
      wechat_id: wechatId.trim() || null  // 保存微信号
    });
    setBook('');
    setContent('');
    setWechatId('');  // 清空微信号输入框
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
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} className="text-blue-600 hover:underline">
              登录 / 注册
            </button>
          )}
        </div>

        {/* 登录弹窗（保持不变） */}
        {showAuth && !user && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full">
              <h2 className="text-2xl font-bold mb-4">{authMode === 'login' ? '登录' : '注册'}</h2>
              <form onSubmit={handleAuth}>
                <input
                  type="email"
                  placeholder="邮箱"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded mb-4"
                  required
                />
                <input
                  type="password"
                  placeholder="密码"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded mb-4"
                  required
                />
                <div className="flex gap-4 mb-4">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                    {authMode === 'login' ? '登录' : '注册'}
                  </button>
                  <button type="button" onClick={() => setShowAuth(false)} className="flex-1 bg-gray-300 py-2 rounded">
                    取消
                  </button>
                </div>
              </form>
              <p className="text-center text-sm">
                {authMode === 'login' ? '没有账号？' : '已有账号？'}
                <button
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-blue-600 hover:underline ml-1"
                >
                  {authMode === 'login' ? '去注册' : '去登录'}
                </button>
              </p>
            </div>
          </div>
        )}

        {/* 发布表单 - 新增微信号输入框 */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-8">
          <input
            type="text"
            placeholder="书名"
            value={book}
            onChange={e => setBook(e.target.value)}
            className="w-full px-4 py-2 border rounded mb-4 focus:outline-none focus:border-blue-500"
            required
          />
          <textarea
            placeholder={user ? "写下你的读书笔记..." : "请先登录后再发布笔记"}
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border rounded mb-4 focus:outline-none focus:border-blue-500"
            required
            disabled={!user}
          />
          <input
            type="text"
            placeholder="你的微信号（可选，方便书友加你）"
            value={wechatId}
            onChange={e => setWechatId(e.target.value)}
            className="w-full px-44 py-2 border rounded mb-4 focus:outline-none focus:border-green-500 text-green-700 placeholder-green-400"
          />
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700" disabled={!user}>
            发布笔记
          </button>
        </form>

        {/* 笔记列表 */}
        {loading ? <p className="text-center text-gray-500">加载中...</p> : notes.map(note => (
          <div key={note.id} className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-semibold text-gray-800">{note.book}</h3>
              <div className="text-right">
                <span className="text-sm text-gray-500 block">by {note.user_name}</span>
                {note.wechat_id && (
                  <span className="text-sm text-green-600 font-medium">
                    微信: {note.wechat_id}（可复制添加）
                  </span>
                )}
              </div>
            </div>
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

            <div className="border-t pt-4">
              <CommentForm noteId={note.id} onComment={fetchNotes} user={user} />
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

function CommentForm({ noteId, onComment, user }: { noteId: number; onComment: () => void; user: any }) {
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from('comments').insert({
      note_id: noteId,
      author: author.trim() || (user ? (user.email?.split('@')[0] || '书友') : '匿名读者'),
      text: text.trim(),
    });
    setAuthor(''); setText(''); onComment();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-4">
      {!user && (
        <input type="text" placeholder="你的名字（可留空）" value={author} onChange={e => setAuthor(e.target.value)}
          className="px-3 py-1 border rounded text-sm" />
      )}
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
