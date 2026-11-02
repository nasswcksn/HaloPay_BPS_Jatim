--
-- Skema basis data HaloPay (karyawan_bps): hanya struktur, tanpa data.
-- Dijalankan otomatis oleh Postgres saat volume data masih kosong, sebelum data awal (init-db.sql)
-- (docker-compose: ./backend/schema.sql -> /docker-entrypoint-initdb.d/01-schema.sql).
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: karyawan_bps; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA karyawan_bps;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: gaji_bulanan; Type: TABLE; Schema: karyawan_bps; Owner: -
--

CREATE TABLE karyawan_bps.gaji_bulanan (
    nip character varying(18) NOT NULL,
    periode character varying(7) NOT NULL,
    gaji_bruto numeric(15,2) DEFAULT 0 NOT NULL,
    simpanan_pokok numeric(15,2) DEFAULT 0,
    simpanan_sukarela numeric(15,2) DEFAULT 0,
    simpanan_wajib numeric(15,2) DEFAULT 0,
    iuran_dwp numeric(15,2) DEFAULT 0,
    iuran_korpri numeric(15,2) DEFAULT 0,
    potongan_pinjaman_koperasi numeric(15,2) DEFAULT 0,
    jumlah_diterima numeric(15,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: karyawan; Type: TABLE; Schema: karyawan_bps; Owner: -
--

CREATE TABLE karyawan_bps.karyawan (
    nip character varying(18) NOT NULL,
    nama character varying(255) NOT NULL,
    no_rekening character varying(50) DEFAULT '-'::character varying,
    email character varying(150),
    jabatan character varying(255),
    satker character varying(10) DEFAULT '3500'::character varying,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tk_bulanan; Type: TABLE; Schema: karyawan_bps; Owner: -
--

CREATE TABLE karyawan_bps.tk_bulanan (
    nip character varying(18) NOT NULL,
    periode character varying(7) NOT NULL,
    tunjangan_kinerja numeric(15,2) DEFAULT 0 NOT NULL,
    simpanan_sukarela numeric(15,2) DEFAULT 0,
    potongan_toko numeric(15,2) DEFAULT 0,
    potongan_barang_koperasi numeric(15,2) DEFAULT 0,
    potongan_pinjaman_koperasi numeric(15,2) DEFAULT 0,
    potongan_pinjaman_dwp numeric(15,2) DEFAULT 0,
    potongan_untalan numeric(15,2) DEFAULT 0,
    potongan_arisan_dwp numeric(15,2) DEFAULT 0,
    potongan_gagal_debet numeric(15,2) DEFAULT 0,
    jumlah_diterima numeric(15,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: karyawan_bps; Owner: -
--

CREATE TABLE karyawan_bps.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nip character varying(18) NOT NULL,
    nama_lengkap character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    username_slug character varying(255),
    role character varying(20) DEFAULT 'karyawan'::character varying NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'karyawan'::character varying])::text[])))
);


--
-- Name: gaji_bulanan gaji_bulanan_pkey; Type: CONSTRAINT; Schema: karyawan_bps; Owner: -
--

ALTER TABLE ONLY karyawan_bps.gaji_bulanan
    ADD CONSTRAINT gaji_bulanan_pkey PRIMARY KEY (nip, periode);


--
-- Name: karyawan karyawan_pkey; Type: CONSTRAINT; Schema: karyawan_bps; Owner: -
--

ALTER TABLE ONLY karyawan_bps.karyawan
    ADD CONSTRAINT karyawan_pkey PRIMARY KEY (nip);


--
-- Name: tk_bulanan tk_bulanan_pkey; Type: CONSTRAINT; Schema: karyawan_bps; Owner: -
--

ALTER TABLE ONLY karyawan_bps.tk_bulanan
    ADD CONSTRAINT tk_bulanan_pkey PRIMARY KEY (nip, periode);


--
-- Name: users users_nip_key; Type: CONSTRAINT; Schema: karyawan_bps; Owner: -
--

ALTER TABLE ONLY karyawan_bps.users
    ADD CONSTRAINT users_nip_key UNIQUE (nip);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: karyawan_bps; Owner: -
--

ALTER TABLE ONLY karyawan_bps.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: karyawan_bps; Owner: -
--

ALTER TABLE ONLY karyawan_bps.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_karyawan_bps_gaji_periode; Type: INDEX; Schema: karyawan_bps; Owner: -
--

CREATE INDEX idx_karyawan_bps_gaji_periode ON karyawan_bps.gaji_bulanan USING btree (periode);


--
-- Name: idx_karyawan_bps_tk_periode; Type: INDEX; Schema: karyawan_bps; Owner: -
--

CREATE INDEX idx_karyawan_bps_tk_periode ON karyawan_bps.tk_bulanan USING btree (periode);


--
-- Name: gaji_bulanan gaji_bulanan_nip_fkey; Type: FK CONSTRAINT; Schema: karyawan_bps; Owner: -
--

ALTER TABLE ONLY karyawan_bps.gaji_bulanan
    ADD CONSTRAINT gaji_bulanan_nip_fkey FOREIGN KEY (nip) REFERENCES karyawan_bps.karyawan(nip) ON DELETE CASCADE;


--
-- Name: tk_bulanan tk_bulanan_nip_fkey; Type: FK CONSTRAINT; Schema: karyawan_bps; Owner: -
--

ALTER TABLE ONLY karyawan_bps.tk_bulanan
    ADD CONSTRAINT tk_bulanan_nip_fkey FOREIGN KEY (nip) REFERENCES karyawan_bps.karyawan(nip) ON DELETE CASCADE;


--
-- Name: users users_nip_fkey; Type: FK CONSTRAINT; Schema: karyawan_bps; Owner: -
--

ALTER TABLE ONLY karyawan_bps.users
    ADD CONSTRAINT users_nip_fkey FOREIGN KEY (nip) REFERENCES karyawan_bps.karyawan(nip) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


