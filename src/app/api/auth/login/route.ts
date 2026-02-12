import { NextResponse } from 'next/server';
import dbConnect from '@/utils/db';
import User from '@/models/User';
import { z } from 'zod';

// Force dynamic to prevent static optimization issues which can cause empty responses in some setups
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  try {
    // 1. Safe JSON Parsing
    // "Unexpected end of JSON input" often happens if the body is empty or malformed
    let body;
    try {
      const text = await request.text();
      if (!text) {
        return NextResponse.json({ success: false, message: 'Missing request body' }, { status: 400 });
      }
      body = JSON.parse(text);
    } catch (err) {
      return NextResponse.json({ success: false, message: 'Invalid JSON format' }, { status: 400 });
    }

    // 2. Input Validation
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      const errorMessage = result.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ 
        success: false, 
        message: errorMessage, 
        errors: result.error.flatten() 
      }, { status: 400 });
    }

    const { email, password } = result.data;

    // 3. Database Connection
    await dbConnect();

    // 4. User Lookup
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    // 5. Password Verification
    // Assuming comparePassword exists on the model as per previous code
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    // 6. Update User Stats (Safe Update)
    try {
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined; // Clear lock if exists
      user.lastLogin = new Date();
      await user.save();
    } catch (statsError) {
      console.error("Failed to update user login stats:", statsError);
      // Continue login process even if stats update fails
    }

    // 7. Success Response
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email, 
        name: user.name,
        role: user.role 
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Login error:', error);
    
    // 8. Global Error Handler - ALWAYS returns JSON
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
