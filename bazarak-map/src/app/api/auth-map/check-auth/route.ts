
import { NextRequest, NextResponse } from 'next/server';
import { isValidMapToken } from '../../../../lib/map-auth';

interface User {
  id: string;
  name: string;
  role: 'admin' | 'driver';
}

export async function GET(req: NextRequest) {
  try {
    const adminToken = req.cookies.get('bazarek_map_admin_token')?.value;
    const driverToken = req.cookies.get('bazarek_map_driver_token')?.value;
    
    let user: User | null = null;
    
    if (isValidMapToken(adminToken)) {
      user = {
        id: 'admin-1',
        name: 'مدیر سیستم',
        role: 'admin'
      };
    } else if (isValidMapToken(driverToken)) {
      user = {
        id: 'driver-1',
        name: 'راننده',
        role: 'driver'
      };
    }
    
    if (!user) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
