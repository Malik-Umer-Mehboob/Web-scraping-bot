import { NextResponse } from 'next/server';
import dbConnect from '@/utils/db';
import User from '@/models/User';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  await dbConnect();
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date();
    await user.save();

    return NextResponse.json({
      message: 'Login successful',
      user: { id: user._id, username: user.username, email: user.email, name: user.name }
    }, { status: 200 });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
