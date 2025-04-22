const { Pool } = require('pg');

// Create a PostgreSQL connection pool
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'studio_indexer',
  user: 'postgres',
  password: 'postgres'
});

async function removeVerification() {
  const client = await pool.connect();
  try {
    // Check if the contract exists and has verification data
    const checkResult = await client.query(
      `SELECT 
        address, 
        verified, 
        source_code IS NOT NULL AS has_source, 
        abi IS NOT NULL AS has_abi 
      FROM contracts 
      WHERE address = $1`,
      ['0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E']
    );

    if (checkResult.rows.length === 0) {
      console.log('Contract not found in the database');
      return;
    }

    const contract = checkResult.rows[0];
    console.log('Contract verification status:');
    console.log(`- Address: ${contract.address}`);
    console.log(`- Verified: ${contract.verified}`);
    console.log(`- Has source code: ${contract.has_source}`);
    console.log(`- Has ABI: ${contract.has_abi}`);

    // Remove verification data
    const updateResult = await client.query(
      `UPDATE contracts 
      SET 
        verified = false, 
        source_code = NULL, 
        abi = NULL, 
        compiler_version = NULL, 
        optimization_used = NULL, 
        runs = NULL, 
        constructor_arguments = NULL, 
        libraries = NULL, 
        verified_at = NULL,
        evm_version = NULL
      WHERE address = $1
      RETURNING address`,
      ['0xFcCC20bf4f0829e121bC99FF2222456Ad4465A1E']
    );

    if (updateResult.rows.length > 0) {
      console.log(`Verification data removed for contract ${updateResult.rows[0].address}`);
    } else {
      console.log('No contract was updated');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

removeVerification().catch(console.error);
